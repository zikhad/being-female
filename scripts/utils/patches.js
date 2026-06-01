const fs = require("fs-extra");
const path = require("path");

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

module.exports = {
    patchPipeWrenchLua
};