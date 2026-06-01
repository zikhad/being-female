#!/usr/bin/env node

const path = require("path");
const os = require("os");
const fs = require("fs-extra");
const archiver = require("archiver");
const { Command } = require("commander");

const { copyFolder, getInfo, getLocale } = require("./utils");

/**
 * Parses and validates language argument.
 * @returns {{ language: string, locale: string }}
 */
const getArgs = () => {
	const program = new Command();
	program.argument("<language>", "Language code to zip (e.g. pt, es, de)").parse();

	const language = (program.args[0] || "").trim().toLowerCase();
	if (!language) {
		throw new Error("Please specify a language, e.g. npm run zip:translation -- pt");
	}

	return { language, locale: getLocale(language) };
};

const createTranslationZip = async () => {
	const { locale } = getArgs();
	const { id, name, version } = getInfo();
	const localePackagePath = path.join(process.cwd(), "dist", `${name} - ${locale}`);

	if (!(await fs.pathExists(localePackagePath))) {
		console.error(
			`Error: translated package does not exist at ${localePackagePath}. Run npm run translate -- <lang> first.`
		);
		process.exit(1);
	}

	const tempPath = path.join(os.tmpdir(), `${name}-${locale}-temp`);
	const zipname = `${id}-${locale.toLowerCase()}-${version}.zip`;

	await fs.remove(tempPath);
	await fs.ensureDir(tempPath);

	try {
		await copyFolder(localePackagePath, tempPath);

		const output = fs.createWriteStream(zipname);
		const archive = archiver("zip", { zlib: { level: 9 } });

		archive.pipe(output);
		archive.directory(tempPath, false);
		await archive.finalize();

		console.log(`Translation zip file created successfully: ${zipname}`);
	} finally {
		await fs.remove(tempPath);
	}
};

createTranslationZip().catch(err => {
	console.error("Error preparing translation zip file:", err);
	process.exitCode = 1;
});
