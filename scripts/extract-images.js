#!/usr/bin/env node

/** Compatibility entry point for the shared animation extraction CLI. */
import("./animation-creator/cli.mjs").catch(error => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
