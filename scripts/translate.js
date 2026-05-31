#!/usr/bin/env node

const path = require("path");
const fs = require("fs-extra");
const { Command } = require("commander");
const translate = require("translatte");

const { copyFolder, getInfo, startProgressBar, stopProgressBar } = require("./utils");

/**
 * Converts a language code to Project Zomboid locale format.
 * @param {string} language
 * @returns {string}
 */
const getLocale = language => {
	switch (language.toLowerCase()) {
		case "pt":
			return "PTBR";
		default:
			return language.toUpperCase();
	}
};

/**
 * Converts info object back to .info content.
 * @param {Record<string, string | undefined>} info
 * @returns {string}
 */
const stringifyInfoFile = info => {
	return Object.entries(info)
		.filter(([, value]) => value !== undefined && value !== null)
		.map(([key, value]) => `${key}=${value}`)
		.join("\n");
};

/**
 * Loads translations from an existing JSON file into a map.
 * @param {string} filePath
 * @returns {Promise<Map<string, string>>}
 */
const loadTranslations = async filePath => {
	const map = new Map();
	if (!(await fs.pathExists(filePath))) {
		return map;
	}

	const json = await fs.readJson(filePath);
	for (const [key, value] of Object.entries(json)) {
		if (typeof value === "string") {
			map.set(key, value);
		}
	}

	return map;
};

/**
 * Creates output folder for a locale package.
 * @param {string} locale
 * @returns {Promise<string>}
 */
const createOutputFolder = async locale => {
	const { name } = getInfo();
	const outputDir = path.join(process.cwd(), "dist", `${name} - ${locale}`);
	await fs.ensureDir(outputDir);
	return outputDir;
};

/**
 * Generates translation JSON files for one locale package.
 * Priority order:
 * 1) Existing output translations (preserve previous human edits)
 * 2) src/translations-json/{LOCALE} human-reviewed translations
 * 3) Machine-translate missing keys from EN
 *
 * @param {string} language
 * @param {string} locale
 * @param {string} outputPath
 */
const generateLocaleTranslations = async (language, locale, outputPath) => {
	const sourceEnPath = path.join(process.cwd(), "src", "translations-json", "EN");
	if (!(await fs.pathExists(sourceEnPath))) {
		throw new Error("Missing EN source translations at src/translations-json/EN");
	}

	const targetTranslateDir = path.join(outputPath, "42", "media", "lua", "shared", "Translate", locale);
	await fs.ensureDir(targetTranslateDir);

	const humanReviewedLocaleDir = path.join(process.cwd(), "src", "translations-json", locale);
	const allSourceFiles = await fs.readdir(sourceEnPath);
	const files = allSourceFiles.filter(file => path.extname(file).toLowerCase() === ".json");
	const filePlans = [];
	let totalMissingKeys = 0;

	for (const file of files) {
		const enFilePath = path.join(sourceEnPath, file);
		const outFilePath = path.join(targetTranslateDir, file);
		const sourceContent = await fs.readJson(enFilePath);
		const translations = new Map();

		for (const [key, value] of await loadTranslations(outFilePath)) {
			translations.set(key, value);
		}

		for (const [key, value] of await loadTranslations(path.join(humanReviewedLocaleDir, file))) {
			translations.set(key, value);
		}

		const toTranslate = Object.entries(sourceContent).filter(([key]) => !translations.has(key));
		totalMissingKeys += toTranslate.length;
		filePlans.push({
			file,
			outFilePath,
			toTranslate,
			translations
		});
	}

	console.info(`Translation plan ready for ${files.length} files.`);
	console.info(`Missing keys to machine-translate: ${totalMissingKeys}`);

	const translationProgress = startProgressBar(totalMissingKeys, {
		format: "Translate |{bar}| {percentage}% | {value}/{total} keys",
		unit: "keys"
	});

	for (const filePlan of filePlans) {
		for (const [key, value] of filePlan.toTranslate) {
			if (typeof value !== "string") {
				continue;
			}
			const translated = await translate(value, { to: language });
			filePlan.translations.set(key, translated.text);
			if (translationProgress) {
				translationProgress.increment();
			}
		}

		const sorted = Object.fromEntries(
			[...filePlan.translations.entries()].sort(([a], [b]) => a.localeCompare(b))
		);
		await fs.writeJson(filePlan.outFilePath, sorted, { spaces: 4 });
	}

	stopProgressBar(translationProgress);
};

/**
 * Copies root assets to output root and output/42.
 * @param {string} outputPath
 */
const copyRootAssets = async outputPath => {
	const rootSource = path.join(process.cwd(), "src", "root");
	if (!(await fs.pathExists(rootSource))) {
		return;
	}

	await copyFolder(rootSource, outputPath);
	await copyFolder(rootSource, path.join(outputPath, "42"));
};

/**
 * Creates mod.info for translated locale package.
 * @param {string} outputPath the path to the output directory for the locale package
 * @param {string} locale the locale being generated (e.g., "PTBR")
 * @param {string} language the original language code (e.g., "pt") for translation purposes
 */
const writeTranslatedModInfo = async (outputPath, locale, language) => {
	
    const { id, name, modInfo } = getInfo();    
    const description = translate(`Translation package for ${name} in ${locale}.`, { to: language });
    const require = [
        ...(modInfo.require ?? []),
        id
    ];

	const infoContent = stringifyInfoFile({
		...modInfo,
		id: `${id}-${locale.toLowerCase()}`,
		name: `${name} - ${locale}`,
        description,
		require: require
	});

	await fs.writeFile(path.join(outputPath, "mod.info"), infoContent);
	await fs.ensureDir(path.join(outputPath, "42"));
	await fs.writeFile(path.join(outputPath, "42", "mod.info"), infoContent);
};

/**
 * Parses and validates language argument.
 * @returns {{language: string, locale: string}}
 */
const getArgs = () => {
	const program = new Command();
	program
		.argument("<language>", "Language code to translate to (e.g. pt, es, de)")
		.parse();

	const language = (program.args[0] || "").trim().toLowerCase();
	if (!language) {
		throw new Error("Please specify a language, e.g. npm run translate -- pt");
	}

	return { language, locale: getLocale(language) };
};

const run = async () => {
	const { language, locale } = getArgs();
	const outputPath = await createOutputFolder(locale);

	await generateLocaleTranslations(language, locale, outputPath);
	await copyRootAssets(outputPath);
	await writeTranslatedModInfo(outputPath, locale , language);

	console.info(`Translations package generated: ${outputPath}`);
};

run().catch(err => {
	console.error("Translations - Error generating translations:", err);
	process.exitCode = 1;
});
