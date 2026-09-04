const fs = require("fs-extra");
const path = require("path");
const sharp = require("sharp");
const { startProgressBar, stopProgressBar } = require("./progressBar");
const { getInfo } = require("./info");
const { PNG_COMPRESSION_OPTIONS } = require("./imageOptimization");

/**
 * Remove .DS_Store files recursively
 * @param {string} dir the folder to look for .DS_Store files
 */
const removeDSStore = dir => {
	fs.readdirSync(dir).forEach(file => {
		const filePath = path.join(dir, file);
		const stats = fs.statSync(filePath);

		if (stats.isDirectory()) {
			removeDSStore(filePath);
		} else if (file === ".DS_Store") {
			fs.unlinkSync(filePath);
		}
	});
};

/**
 * Optimize Images using sharp library
 * @param {string} srcFilePath image to optimize
 * @param {string} destFilePath path to save the optimized image
 */
const optimizeImage = async (srcFilePath, destFilePath) => {
	try {
		const ext = path.extname(srcFilePath).toLowerCase();
		const image = sharp(srcFilePath);
		if (ext === ".png") {
			await image.png(PNG_COMPRESSION_OPTIONS).toFile(destFilePath);
		} else if ([".jpg", ".jpeg"].includes(ext)) {
			await image.jpeg({ quality: 80 }).toFile(destFilePath);
		}
	} catch (error) {
		console.error(`⚠️ Failed to optimize image ${srcFilePath}:`, error);
	}
};

/**
 * Recursively all files paths
 * @param {string} dir folder to look for files
 * @returns {Promise<string[]>} path with all the files
 */
const gatherAllFiles = async dir => {
	const items = await fs.readdir(dir, { withFileTypes: true });
	const filePaths = [];

	for (const item of items) {
		const fullPath = path.join(dir, item.name);
		if (item.isDirectory()) {
			const subFiles = await gatherAllFiles(fullPath);
			filePaths.push(...subFiles);
		} else {
			filePaths.push(fullPath);
		}
	}
	return filePaths;
};

/**
 * Recursively copy files while optimizing images
 * @param {string} srcDir Path to copy from
 * @param {string} destDir Path to copy to
 * @param {import("cli-progress").SingleBar | null} progressBar
 */
const copyAndOptimizeRecursive = async (srcDir, destDir, progressBar) => {
	const items = await fs.readdir(srcDir, { withFileTypes: true });
	await fs.ensureDir(destDir);

	for (const item of items) {
		const srcPath = path.join(srcDir, item.name);
		const destPath = path.join(destDir, item.name);

		if (item.isDirectory()) {
			await copyAndOptimizeRecursive(srcPath, destPath, progressBar);
		} else {
			const ext = path.extname(item.name).toLowerCase();
			const isImage = [".png", ".jpg", ".jpeg"].includes(ext);

			if (isImage) {
				await optimizeImage(srcPath, destPath);
			} else {
				await fs.copy(srcPath, destPath);
			}

			if (progressBar) {
				progressBar.increment();
			}
		}
	}
};

/**
 * Copy folder, while recursively optimize images
 * @param {string} srcPath Path to copy from
 * @param {string} destPath Path to copy to
 */
const copyFolder = async (srcPath, destPath) => {
	console.log(`📁 Starting copy from ${srcPath} to ${destPath}...`);
	if (!fs.existsSync(srcPath)) {
		console.log(`📁 No files to copy from ${srcPath}...`);
	} else {
		console.log(`📁 Copying and optimizing files from ${srcPath} to ${destPath}`);

		const allFiles = await gatherAllFiles(srcPath);
		const totalFiles = allFiles.length;
		const progressBar = startProgressBar(totalFiles, {
			unit: "files"
		});

		await copyAndOptimizeRecursive(srcPath, destPath, progressBar);

		removeDSStore(destPath);

		stopProgressBar(progressBar);
		console.log("✅ Copy and optimization complete!");
	}
};

/**
 * Move folder from srcPath to destPath, overwriting if necessary
 * @param {string} srcPath Path to move from
 * @param {string} destPath Path to move to
 */
const moveFolder = async (srcPath, destPath) => {
	console.log(`📁 Moving folder from ${srcPath} to ${destPath}...`);
	await fs.move(srcPath, destPath, { overwrite: true });
	console.log("✅ Folder moved successfully!");
};

/**
 * returns the src Path for this operation
 * @param {string} dirPath
 * @returns {string}
 */
const srcPath = dirPath => path.join(process.cwd(), dirPath);

/**
 * returns the dist path (inside media) for this operation
 * @param {string} dirPath
 * @returns {string}
 */
const distPath = (dirPath = "") => {
	const { name } = getInfo();
	return path.join(process.cwd(), "dist", name, dirPath);
};

module.exports = {
	copyFolder,
	moveFolder,
	srcPath,
	distPath,
};
