const path = require("path");
const fs = require("fs-extra");
const { copyFolder, moveFolder, getInfo } = require("./utils");

/**
 * returns the src Path for this operation
 * @param {string} dirPath
 * @returns {string}
 */
const srcPath = dirPath => path.join(process.cwd(), dirPath);

/**
 * returns the dist path (inside media) for this operation
 * @param {string} dirPath
 * @returns {string}
 */
const distPath = (dirPath = "") => {
	const { name } = getInfo();
	return path.join(process.cwd(), "dist", name, dirPath);
};

/**
 * Patches PipeWrench-generated Lua files to avoid spurious WARNs in PZ's console.
 *
 * - client.lua and PipeWrench.lua: replace generated stubs of the form
 *   `loadstring("require('X');return _G['Y']")()` with `_G['Y']`.
 *   The PipeWrench package only uses these imports to surface globals from
 *   the game runtime; requiring them eagerly in Build 42 produces false
 *   mod errors during startup.
 * - lualib_bundle.lua: replace bundled test fixture require with runtime
 *   `require "ISBaseObject"`.
 *
 * @param {string} basePath - root of the built mod folder (e.g. dist/ZomboLustBeingFemale)
 */
const patchPipeWrenchLua = async basePath => {
	const glob = await fs.readdir(basePath, { recursive: true }).catch(() => []);

	// fs.readdir with recursive option returns relative paths on Node >=18
	const allFiles = Array.isArray(glob)
		? glob.map(f => path.join(basePath, f))
		: [];

	for (const filePath of allFiles) {
		const base = path.basename(filePath);

		if (base !== "client.lua" && base !== "PipeWrench.lua" && base !== "lualib_bundle.lua") {
			continue;
		}

		const stat = await fs.stat(filePath).catch(() => null);
		if (!stat || !stat.isFile()) {
			continue;
		}

		let content = await fs.readFile(filePath, "utf8");
		let changed = false;

		if (base === "client.lua") {
			const patched = content.replace(
				/loadstring\("require\('[^']+'\);return _G\['([^']+)'\]"\)\(\)/g,
				"_G['$1']"
			);
			if (patched !== content) {
				content = patched;
				changed = true;
			}
		}

		if (base === "PipeWrench.lua") {
			const patched = content.replace(
				/loadstring\("require\('[^']+'\);return _G\['([^']+)'\]"\)\(\)/g,
				"_G['$1']"
			);
			if (patched !== content) {
				content = patched;
				changed = true;
			}
		}

		if (base === "lualib_bundle.lua") {
			const patched = content.replace(
				/require\s+"tests\/classExtendEachOther\/base\/ISBaseObject"/g,
				"require \"ISBaseObject\""
			);
			if (patched !== content) {
				content = patched;
				changed = true;
			}
		}

		if (changed) {
			await fs.writeFile(filePath, content, "utf8");
		}
	}
};

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
		await moveFolder(path.join(process.cwd(), "dist", id), distPath());
		
		// Copy root assets to both dist/Name and dist/Name/42
		await copyFolder(srcPath("src/root"), distPath());
		await copyFolder(srcPath("src/root"), distPath("42"));

		// Copy mod.info to dist/Name/mod.info to dist/Name/42/mod.info
		await fs.copy(distPath("mod.info", false), distPath("42/mod.info"));
		
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
