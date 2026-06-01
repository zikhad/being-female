const { copyFolder, moveFolder, srcPath, distPath } = require("./folders");
const { getInfo } = require("./info");
const { getLocale } = require("./locale");
const { createProgressBar, startProgressBar, stopProgressBar } = require("./progressBar");
const { patchPipeWrenchLua } = require("./patches");

module.exports = {
	copyFolder,
	moveFolder,
	srcPath,
	distPath,
	createProgressBar,
	getInfo,
	getLocale,
	startProgressBar,
	stopProgressBar,
	patchPipeWrenchLua
};
