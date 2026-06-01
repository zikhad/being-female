#!/usr/bin/env node

const { Command } = require("commander");
const { getInfo, getLocale } = require("./utils");

const program = new Command();
program.argument("<language>", "Language code to zip (e.g. pt, es, de)").parse();

const language = (program.args[0] || "").trim().toLowerCase();
if (!language) {
	throw new Error("Please specify a language, e.g. npm run zipname:translation -- pt");
}

const { id, version } = getInfo();
const locale = getLocale(language);

console.log(`${id}-${locale.toLowerCase()}-${version}.zip`);
