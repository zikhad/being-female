const cliProgress = require("cli-progress");

/**
 * Creates a configured cli-progress SingleBar instance.
 * @param {{format?: string, unit?: string}} [options]
 * @returns {import("cli-progress").SingleBar}
 */
const createProgressBar = (options = {}) => {
	const { format, unit = "items" } = options;
	return new cliProgress.SingleBar({
		format: format || `Progress |{bar}| {percentage}% | {value}/{total} ${unit}`,
		barCompleteChar: "█",
		barIncompleteChar: "░",
		hideCursor: true
	});
};

/**
 * Creates and starts a progress bar only when total > 0.
 * @param {number} total
 * @param {{format?: string, unit?: string}} [options]
 * @returns {import("cli-progress").SingleBar | null}
 */
const startProgressBar = (total, options = {}) => {
	if (!Number.isFinite(total) || total <= 0) {
		return null;
	}

	const progressBar = createProgressBar(options);
	progressBar.start(total, 0);
	return progressBar;
};

/**
 * Safely stops a progress bar if it exists.
 * @param {import("cli-progress").SingleBar | null} progressBar
 */
const stopProgressBar = progressBar => {
	if (progressBar) {
		progressBar.stop();
	}
};

module.exports = {
	createProgressBar,
	startProgressBar,
	stopProgressBar
};