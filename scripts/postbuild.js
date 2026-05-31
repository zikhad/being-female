const path = require("path");
const fs = require("fs-extra");
const { srcPath, distPath, copyFolder, moveFolder, getInfo, patchPipeWrenchLua } = require("./utils");

/**
 * Copy EN translations from src/translations-json/LOCALE to the Build 42 output folder, ensuring the directory structure is correct.
 * @param {string} outputPath the path to the output directory for translations (e.g., 42/media/lua/shared/Translate/LOCALE)
 * @param {string} locale the locale to copy (default: "EN")
 */
const translations = async (outputPath, locale = "EN") => {
	const sourceDir = srcPath(`src/translations-json/${locale}`);
	if (!(await fs.pathExists(sourceDir))) {
		console.info(`No src/translations-json/${locale} found; skipping translations.`);
		return;
	}
	await fs.ensureDir(path.join(outputPath, locale));
	const translationFiles = await fs.readdir(sourceDir);
	for (const file of translationFiles) {
		const json = await fs.readJSON(path.join(sourceDir, file));
		const sortedTranslations = new Map(Object.entries(json).sort());
		await fs.writeJson(path.join(outputPath, locale, file), Object.fromEntries(sortedTranslations), { spaces: 4 });
	}
	console.info(`${locale} Translations copied successfully.`);
}

const run = async () => {
	try {
		const { id } = getInfo();

		// Move the built mod from dist/id to dist/Name
		const generatedDistPath = path.join(process.cwd(), "dist", id);
		if (generatedDistPath !== distPath()) {
			await moveFolder(generatedDistPath, distPath());
		} else {
			console.warn(`Generated dist path ${generatedDistPath} is the same as target dist path ${distPath()}. Skipping move to avoid overwriting source.`);
		}

		// Copy root assets to both dist/Name and dist/Name/42
		await copyFolder(srcPath("src/root"), distPath());
		await copyFolder(srcPath("src/root"), distPath("42"));

		// Copy mod.info to dist/Name/mod.info to dist/Name/42/mod.info
		await fs.copy(distPath("mod.info"), distPath("42/mod.info"));

		// Move generated media from dist/Name/media to dist/Name/42/media
		await moveFolder(distPath("media"), distPath("42/media"));

		// Copy media assets to dist/Name/42/media
		await copyFolder(srcPath("src/media"), distPath("42/media"));

		// Copy EN translations to dist/Name/42/media/lua/shared/Translate/EN - these are the only translations shipped with the base mod
		await translations(distPath("42/media/lua/shared/Translate"));

		// Patch PipeWrench-generated Lua files to avoid spurious WARNs in PZ's console
		await patchPipeWrenchLua(distPath("42"));
		console.log("PipeWrench Lua files patched.");

	} catch (err) {
		console.error("Error copying files:", err);
		process.exitCode = 1;
	}
};

run();
