const { copyFolder, moveFolder, srcPath, distPath } = require("./folders");
const { getInfo } = require("./info");
const { createProgressBar, startProgressBar, stopProgressBar } = require("./progressBar");

module.exports = {
	copyFolder,
	moveFolder,
	srcPath,
	distPath,
	createProgressBar,
	getInfo,
	startProgressBar,
	stopProgressBar,
};
