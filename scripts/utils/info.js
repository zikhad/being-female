const { readFileSync } = require("fs-extra");
const { join } = require("path");

/**
 * Reads and parses `package.json` and `pipewrench.json` files from the current working directory,
 * and returns relevant mod packaging info.
 *
 * @returns {{ id: string, name: string, modInfo: Record<string, unknown>, version: string, zipname: string }} An object containing:
 * - `id`: The mod ID from `pipewrench.json`
 * - `name`: The mod name from `pipewrench.json`
 * - `modInfo`: The raw modInfo object from `pipewrench.json`
 * - `version`: The version from `package.json`
 * - `zipname`: A zip filename combining mod ID and version
 */
const getInfo = () => {
	/** @type {{ version: string }} */
	const { version } = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8"));

	/** @type {{ modInfo: { id: string, name: string } }} */
	const { modInfo } = JSON.parse(readFileSync(join(process.cwd(), "pipewrench.json"), "utf-8"));
	const { id, name } = modInfo;

	return {
		id,
		name,
		modInfo,
		version,
		zipname: `${name}-${version}.zip`
	};
};

module.exports = {
	getInfo
};
