const fs = require("fs-extra");
const path = require("path");

/** Lua loader scopes emitted by the PipeWrench TypeScript-to-Lua plugin. */
const LUA_SCOPES = ["shared", "client", "server"];

/**
 * Namespaces compiler-owned Lua helpers and their requires.
 *
 * BF-owned TypeScript modules acquire their namespace from their source paths.
 * PipeWrench and TypeScriptToLua emit their runtime helpers independently at
 * generic paths, so those external artifacts are isolated during packaging.
 * Application modules and Project Zomboid loader-owned paths are never moved;
 * their generated-helper requires are rewritten to the isolated locations.
 *
 * @param {string} luaRoot - packaged `media/lua` directory
 * @param {string} namespace - unique Lua module namespace owned by this mod
 * @returns {Promise<void>}
 */
const namespaceGeneratedLuaModules = async (luaRoot, namespace) => {
	const modulesByScope = new Map();

	for (const scope of LUA_SCOPES) {
		const scopeRoot = path.join(luaRoot, scope);
		modulesByScope.set(scope, await collectLuaModules(scopeRoot));
	}

	const plans = [...modulesByScope].flatMap(([scope, modules]) => {
		const scopeRoot = path.join(luaRoot, scope);
		return modules.map(module => {
			const moduleId = module.relativePath
				.replace(/\.lua$/, "")
				.split(path.sep)
				.join("/");
			const alreadyNamespaced = module.relativePath.split(path.sep)[0] === namespace;
			const shouldMove = !alreadyNamespaced && isGeneratedHelper(moduleId);
			const destination = shouldMove
				? path.join(scopeRoot, namespace, module.relativePath)
				: module.absolutePath;
			return {
				...module,
				moduleId,
				destination,
				finalModuleId: path
					.relative(scopeRoot, destination)
					.replace(/\.lua$/, "")
					.split(path.sep)
					.join("/"),
				shouldMove
			};
		});
	});

	assertUniqueDestinations(plans);
	assertUniqueModuleIds(plans);
	const ownedModules = new Set(plans.filter(plan => plan.shouldMove).map(plan => plan.moduleId));

	for (const plan of plans) {
		const content = await fs.readFile(plan.absolutePath, "utf8");
		const rewritten = rewriteOwnedRequires(content, ownedModules, namespace);

		await fs.ensureDir(path.dirname(plan.destination));
		await fs.writeFile(plan.destination, rewritten, "utf8");
		if (plan.shouldMove) {
			await fs.remove(plan.absolutePath);
		}
	}
};

/**
 * Identifies helpers whose output paths are controlled by compiler plugins.
 *
 * @param {string} moduleId - module path relative to its Lua loader scope
 * @returns {boolean} whether post-build namespacing owns the artifact
 */
const isGeneratedHelper = moduleId =>
	moduleId === "pipewrench_fixes" ||
	moduleId === "lualib_bundle" ||
	moduleId.startsWith("lua_modules/");

/**
 * Rejects namespace mappings that would overwrite another BF-owned module.
 *
 * @param {Array<{absolutePath: string, destination: string}>} plans - planned module writes
 * @returns {void}
 */
const assertUniqueDestinations = plans => {
	const sourceByDestination = new Map();
	for (const plan of plans) {
		const existing = sourceByDestination.get(plan.destination);
		if (existing && existing !== plan.absolutePath) {
			throw new Error(
				`Cannot namespace Lua modules: ${existing} and ${plan.absolutePath} both map to ${plan.destination}`
			);
		}
		sourceByDestination.set(plan.destination, plan.absolutePath);
	}
};

/**
 * Rejects module IDs that would be ambiguous in Project Zomboid's global
 * require namespace, even when the files belong to different loader scopes.
 *
 * @param {Array<{absolutePath: string, finalModuleId: string}>} plans - planned module writes
 * @returns {void}
 */
const assertUniqueModuleIds = plans => {
	const sourceByModuleId = new Map();
	for (const plan of plans) {
		const existing = sourceByModuleId.get(plan.finalModuleId);
		if (existing && existing !== plan.absolutePath) {
			throw new Error(
				`Cannot package Lua modules: ${existing} and ${plan.absolutePath} both define ${plan.finalModuleId}`
			);
		}
		sourceByModuleId.set(plan.finalModuleId, plan.absolutePath);
	}
};

/**
 * Collects Lua files beneath one loader scope before any files are moved.
 *
 * @param {string} scopeRoot - one of the packaged shared, client, or server directories
 * @returns {Promise<Array<{absolutePath: string, relativePath: string}>>}
 */
const collectLuaModules = async scopeRoot => {
	if (!(await fs.pathExists(scopeRoot))) return [];

	const entries = await fs.readdir(scopeRoot, { recursive: true });
	const modules = [];
	for (const entry of entries) {
		if (!entry.endsWith(".lua")) continue;
		const absolutePath = path.join(scopeRoot, entry);
		if ((await fs.stat(absolutePath)).isFile()) {
			modules.push({ absolutePath, relativePath: entry });
		}
	}
	return modules;
};

/**
 * Prefixes literal requires that identify a module packaged by BF.
 *
 * @param {string} content - Lua source to rewrite
 * @param {Set<string>} ownedModules - unqualified module IDs emitted by the build
 * @param {string} namespace - unique Lua module namespace owned by this mod
 * @returns {string} rewritten Lua source
 */
const rewriteOwnedRequires = (content, ownedModules, namespace) =>
	content.replace(
		/require\s*(\(?\s*)(["'])([^"']+)\2(\s*\)?)/g,
		(match, open, quote, moduleId, close) => {
			const normalized = moduleId.replace(/\./g, "/");
			if (normalized.startsWith(`${namespace}/`) || !ownedModules.has(normalized))
				return match;
			return `require${open}${quote}${namespace}/${normalized}${quote}${close}`;
		}
	);

module.exports = {
	namespaceGeneratedLuaModules,
	rewriteOwnedRequires
};
