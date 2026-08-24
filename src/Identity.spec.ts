import * as fs from "node:fs";
import * as path from "node:path";
import {
	BF_NETWORK_MODULE,
	BF_PROTOCOL_SCHEMA_VERSION,
	BF_STATE_MOD_DATA_KEY,
	BF_STATE_SCHEMA_VERSION
} from "@constants";

/** Reads a repository-relative UTF-8 file for identity-boundary assertions. */
const read = (relativePath: string): string =>
	fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("Being Female identity boundary", () => {
	it("uses the canonical package and Project Zomboid metadata", () => {
		const packageJson = JSON.parse(read("package.json"));
		const pipewrench = JSON.parse(read("pipewrench.json"));

		expect(packageJson.name).toBe("being-female");
		expect(packageJson.repository.url).toBe("git+https://github.com/zikhad/being-female.git");
		expect(pipewrench.modInfo).toMatchObject({
			id: "BF",
			name: "Being Female",
			url: "https://github.com/zikhad/being-female"
		});
	});

	it("uses only schema version 1 and BF persistence/network keys", () => {
		expect(BF_NETWORK_MODULE).toBe("BF");
		expect(BF_PROTOCOL_SCHEMA_VERSION).toBe(1);
		expect(BF_STATE_SCHEMA_VERSION).toBe(1);
		expect(BF_STATE_MOD_DATA_KEY).toBe("BF.State");
	});

	it("uses BF source aliases, script modules, recipes, globals, and paths", () => {
		const tsconfig = JSON.parse(read("tsconfig.json"));
		const scripts = read("src/media/scripts/bf/items.txt");
		const recipes = read("src/media/scripts/bf/recipes.txt");
		const traits = read("src/media/scripts/bf/traits.txt");
		const ui = read("src/media/lua/client/BF/BFSimpleUI.lua");
		const tabs = read("src/media/lua/client/BF/BFTabbedUI.lua");
		const sidebar = read("src/media/lua/client/BF/BFSidebar.lua");

		expect(tsconfig.compilerOptions.paths["@client/*"]).toEqual(["client/BF/*"]);
		expect(scripts).toContain("module BF");
		expect(recipes).toContain("module BFRecipes");
		expect(traits).toContain("bf:pregnancy");
		expect(ui).toContain("BFSimpleUI =");
		expect(ui).toContain("function NewBFUI()");
		expect(tabs).toContain("BFTabbedUI =");
		expect(tabs).toContain("function NewBFTabbedUI()");
		expect(sidebar).toContain('BF = require "BF/BF"');
		expect(fs.existsSync(path.join(process.cwd(), "client/BF"))).toBe(false);
		expect(fs.existsSync(path.join(process.cwd(), "src/client/BF"))).toBe(true);
	});

	it("provides Build 42 item-name translations for every BF item", () => {
		const itemNames = [
			"Baby",
			"BreastPump",
			"Condom",
			"CondomBox",
			"CondomUsed",
			"Contraceptive",
			"Lactaid",
			"VaginalDouche"
		].map(item => `BF.${item}`);

		for (const locale of ["EN", "PTBR", "CN", "ES"]) {
			const translations = JSON.parse(read(`src/translations-json/${locale}/ItemName.json`));
			expect(Object.keys(translations).sort()).toEqual(itemNames);
			for (const translation of Object.values(translations)) {
				expect(translation).toEqual(expect.any(String));
				expect(translation).not.toBe("");
			}
		}
	});

	it("keeps every maintained locale aligned with the English translation catalog", () => {
		const translationRoot = "src/translations-json";
		const files = fs
			.readdirSync(path.join(process.cwd(), translationRoot, "EN"))
			.filter(file => file.endsWith(".json"));

		for (const locale of ["PTBR", "CN", "ES"]) {
			for (const file of files) {
				const english = JSON.parse(read(`${translationRoot}/EN/${file}`));
				const translated = JSON.parse(read(`${translationRoot}/${locale}/${file}`));
				expect(Object.keys(translated).sort()).toEqual(Object.keys(english).sort());
			}
		}
	});

	it("keeps the retired prefix only inside the legacy-event boundary", () => {
		const retiredPrefix = ["ZL", "BF"].join("");
		const allowed = new Set([
			"client/BF/LegacyEventCompatibility.ts",
			"client/BF/LegacyEventCompatibility.spec.ts"
		]);
		const sourceRoot = path.join(process.cwd(), "src");
		const matches: string[] = [];

		/** Recursively records source files containing the retired prefix. */
		const visit = (directory: string): void => {
			for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
				const absolute = path.join(directory, entry.name);
				if (entry.isDirectory()) visit(absolute);
				else if (read(path.relative(process.cwd(), absolute)).includes(retiredPrefix)) {
					matches.push(path.relative(sourceRoot, absolute));
				}
			}
		};

		visit(sourceRoot);
		expect(matches.sort()).toEqual([...allowed].sort());
	});
});
