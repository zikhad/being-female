#!/usr/bin/env node

const { Command } = require("commander");
const { getInfo } = require("./utils");

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

const program = new Command();
program.argument("<language>", "Language code to zip (e.g. pt, es, de)").parse();

const language = (program.args[0] || "").trim().toLowerCase();
if (!language) {
	throw new Error("Please specify a language, e.g. npm run zipname:translation -- pt");
}

const { id, version } = getInfo();
const locale = getLocale(language);

console.log(`${id}-${locale.toLowerCase()}-${version}.zip`);
