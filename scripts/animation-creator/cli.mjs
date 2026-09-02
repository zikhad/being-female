import path from "node:path";
import { Command } from "commander";
import { extractFrames } from "./extractor.mjs";

const program = new Command();
program
	.name("extract-images")
	.argument("<input>", "Input video or GIF file")
	.option("--width <number>", "Resize width")
	.option("--height <number>", "Resize height")
	.option("--mode <mode>", "fill or fit", "fill")
	.option("--fps <number>", "Frames per second", "5")
	.option("--starttime <time>", "Start time (HH:MM:SS)", "00:00:00")
	.option("--endtime <time>", "End time (HH:MM:SS)")
	.option("--output <dir>", "Output directory")
	.option("--position <position>", "Crop position", "center")
	.parse();

const input = program.args[0];
const options = program.opts();
const outputDir = options.output ?? path.join(process.cwd(), path.parse(input).name);
console.log("==> Extracting and processing frames...");
const result = await extractFrames({
	input,
	outputDir,
	width: options.width,
	height: options.height,
	mode: options.mode,
	fps: options.fps,
	startTime: options.starttime,
	endTime: options.endtime,
	position: options.position
});
console.log(`Done! ${result.frameCount} frame(s) written to: ${outputDir}`);
