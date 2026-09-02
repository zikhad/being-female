import path from "node:path";
import os from "node:os";
import fs from "fs-extra";
import { execa } from "execa";
import sharp from "sharp";

export const SUPPORTED_EXTENSIONS = [".mp4", ".mov", ".webm", ".gif"];
export const POSITIONS = [
	"center",
	"top",
	"right top",
	"right",
	"right bottom",
	"bottom",
	"left bottom",
	"left",
	"left top"
];

/** Convert an HH:MM:SS timestamp, with optional fractional seconds, to seconds. */
export function timeToSeconds(value) {
	if (typeof value !== "string" || !/^\d+:\d{2}:\d{2}(?:\.\d+)?$/.test(value))
		throw new Error(`Invalid time format: ${value}. Expected HH:MM:SS.`);
	const [hours, minutes, seconds] = value.split(":").map(Number);
	if (minutes > 59 || seconds >= 60) throw new Error(`Invalid time value: ${value}.`);
	return hours * 3600 + minutes * 60 + seconds;
}

/** Normalize and validate extraction options shared by the CLI and web application. */
export function normalizeExtractionOptions(options = {}) {
	const fps = Number(options.fps ?? 5);
	if (!Number.isFinite(fps) || fps <= 0 || fps > 60)
		throw new Error("FPS must be greater than 0 and no more than 60.");
	const hasWidth = options.width !== undefined && options.width !== "";
	const hasHeight = options.height !== undefined && options.height !== "";
	if (hasWidth !== hasHeight) throw new Error("Width and height must be provided together.");
	const width = hasWidth ? Number(options.width) : undefined;
	const height = hasHeight ? Number(options.height) : undefined;
	if (width !== undefined && (!Number.isInteger(width) || width < 1 || width > 4096))
		throw new Error("Width must be an integer between 1 and 4096.");
	if (height !== undefined && (!Number.isInteger(height) || height < 1 || height > 4096))
		throw new Error("Height must be an integer between 1 and 4096.");
	const mode = options.mode ?? "fill";
	if (!["fill", "fit"].includes(mode)) throw new Error("Mode must be either fill or fit.");
	const position = options.position ?? "center";
	if (!POSITIONS.includes(position)) throw new Error(`Unsupported crop position: ${position}.`);
	const startTime = options.startTime ?? options.starttime ?? "00:00:00";
	const endTime = options.endTime ?? options.endtime;
	const startSeconds = timeToSeconds(startTime);
	const endSeconds = endTime ? timeToSeconds(endTime) : undefined;
	if (endSeconds !== undefined && endSeconds <= startSeconds)
		throw new Error("End time must be greater than start time.");
	return { fps, width, height, mode, position, startTime, endTime, startSeconds, endSeconds };
}

/** Validate that a source exists and uses a supported media extension. */
export async function validateSource(input) {
	if (!(await fs.pathExists(input))) throw new Error(`Input file does not exist: ${input}`);
	const extension = path.extname(input).toLowerCase();
	if (!SUPPORTED_EXTENSIONS.includes(extension))
		throw new Error(
			`Unsupported file type: ${extension || "none"}. Supported: ${SUPPORTED_EXTENSIONS.join(", ")}`
		);
	return extension;
}

/** Read duration and dimensions from a supported media source using FFprobe. */
export async function probeMedia(input) {
	await validateSource(input);
	try {
		const result = await execa("ffprobe", [
			"-v",
			"error",
			"-select_streams",
			"v:0",
			"-show_entries",
			"stream=width,height,duration:format=duration",
			"-of",
			"json",
			input
		]);
		const data = JSON.parse(result.stdout);
		const stream = data.streams?.[0] ?? {};
		return {
			width: Number(stream.width) || null,
			height: Number(stream.height) || null,
			duration: Number(stream.duration ?? data.format?.duration) || null
		};
	} catch (error) {
		throw new Error(
			`FFprobe could not inspect the source: ${error.shortMessage ?? error.message}`
		);
	}
}

/** Extract, transform, and zero-base a source media file into sequential PNG frames. */
export async function extractFrames({ input, outputDir, maxFrames = Infinity, ...rawOptions }) {
	await validateSource(input);
	const options = normalizeExtractionOptions(rawOptions);
	await fs.ensureDir(outputDir);
	const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "bf-animation-frames-"));
	const rawDir = path.join(workDir, "raw");
	const processedDir = path.join(workDir, "processed");
	await fs.ensureDir(rawDir);
	await fs.ensureDir(processedDir);
	const args = ["-ss", options.startTime, "-i", input, "-vf", `fps=${options.fps}`];
	if (options.endSeconds !== undefined)
		args.push("-t", String(options.endSeconds - options.startSeconds));
	if (Number.isFinite(maxFrames)) args.push("-frames:v", String(maxFrames + 1));
	args.push(path.join(rawDir, "%d.png"));
	try {
		await execa("ffmpeg", args, { stdout: "inherit", stderr: "inherit" });
	} catch (error) {
		await fs.remove(workDir);
		throw new Error(
			`FFmpeg failed while extracting frames: ${error.shortMessage ?? error.message}`
		);
	}
	const files = (await fs.readdir(rawDir))
		.filter(file => /^\d+\.png$/.test(file))
		.sort((a, b) => Number.parseInt(a) - Number.parseInt(b));
	if (files.length === 0) {
		await fs.remove(workDir);
		throw new Error("The selected range produced no frames.");
	}
	if (files.length > maxFrames) {
		await fs.remove(workDir);
		throw new Error(
			`The extraction produced ${files.length} frames; the limit is ${maxFrames}.`
		);
	}
	try {
		for (const [index, file] of files.entries()) {
			let pipeline = sharp(path.join(rawDir, file));
			if (options.width && options.height)
				pipeline = pipeline.resize({
					width: options.width,
					height: options.height,
					fit: options.mode === "fit" ? "contain" : "cover",
					background: { r: 0, g: 0, b: 0, alpha: 0 },
					position: options.position
				});
			await pipeline.png().toFile(path.join(processedDir, `${index}.png`));
		}
		const existing = (await fs.readdir(outputDir)).filter(file => /^\d+\.png$/.test(file));
		await Promise.all(existing.map(file => fs.remove(path.join(outputDir, file))));
		for (let index = 0; index < files.length; index++)
			await fs.move(
				path.join(processedDir, `${index}.png`),
				path.join(outputDir, `${index}.png`)
			);
	} catch (error) {
		await fs.remove(workDir);
		throw error;
	}
	await fs.remove(workDir);
	const first = await sharp(path.join(outputDir, "0.png")).metadata();
	return {
		frameCount: files.length,
		width: first.width,
		height: first.height,
		fps: options.fps,
		duration: files.length / options.fps,
		frames: files.map((_, index) => path.join(outputDir, `${index}.png`)),
		options
	};
}
