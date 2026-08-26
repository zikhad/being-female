const fs = require("fs-extra");
const path = require("path");

/**
 * Patches PipeWrench-generated Lua for the current Project Zomboid runtime.
 *
 * - client.lua and PipeWrench.lua: replace generated global lookup stubs with
 *   direct `_G['Y']` access. Both embedded-require and plain lookup forms are
 *   supported because Project Zomboid 42.20.4 removed `loadstring`.
 * - PipeWrench.lua: remove the obsolete dynamic compilation exports. BF does
 *   not use them and the game no longer provides an implementation.
 *   The PipeWrench package only uses these imports to surface globals from
 *   the game runtime; dynamic compilation is unavailable in Build 42.20.4.
 * - lualib_bundle.lua: replace bundled test fixture require with runtime
 *   `require "ISBaseObject"`.
 *
 * @param {string} basePath - root of the built mod folder (e.g. dist/BF)
 */
const patchPipeWrenchLua = async basePath => {
	const glob = await fs.readdir(basePath, { recursive: true });

	// fs.readdir with recursive option returns relative paths on Node >=18
	const allFiles = Array.isArray(glob) ? glob.map(f => path.join(basePath, f)) : [];

	for (const filePath of allFiles) {
		const base = path.basename(filePath);

		if (base !== "client.lua" && base !== "PipeWrench.lua" && base !== "lualib_bundle.lua") {
			continue;
		}

		const stat = await fs.stat(filePath);
		if (!stat.isFile()) {
			continue;
		}

		const content = await fs.readFile(filePath, "utf8");
		const patched = patchPipeWrenchContent(base, content);

		if (patched !== content) {
			await fs.writeFile(filePath, patched, "utf8");
		}
	}
};

/**
 * Applies the supported generated-Lua transformations for one known file.
 * Arbitrary dynamic Lua expressions are intentionally left unchanged so the
 * package assertion can reject them instead of guessing at their semantics.
 *
 * @param {string} baseName - basename of the generated Lua file
 * @param {string} content - generated Lua source
 * @returns {string} patched Lua source
 */
const patchPipeWrenchContent = (baseName, content) => {
	if (baseName === "client.lua" || baseName === "PipeWrench.lua") {
		content = content.replace(
			/loadstring\("(?:require\('[^']+'\);)?return _G\['([^']+)'\]"\)\(\)/g,
			"_G['$1']"
		);
	}

	if (baseName === "PipeWrench.lua") {
		content = content
			.replace(/^function Exports\.loadstring\(lua\) return loadstring\(lua\) end\r?\n/gm, "")
			.replace(
				/^function Exports\.execute\(lua\) return loadstring\(lua\)\(\) end\r?\n/gm,
				""
			);
	}

	if (baseName === "lualib_bundle.lua") {
		content = content.replace(
			/require\s+"tests\/classExtendEachOther\/base\/ISBaseObject"/g,
			'require "ISBaseObject"'
		);
	}

	return content;
};
module.exports = {
	patchPipeWrenchLua
};
