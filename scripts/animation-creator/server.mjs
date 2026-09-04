import http from "node:http";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import fs from "fs-extra";
import archiver from "archiver";
import { extractFrames, probeMedia, SUPPORTED_EXTENSIONS } from "./extractor.mjs";
import {
	expandPlayback,
	hashConfiguration,
	normalizeCreatorConfig,
	requiredSlots
} from "./config.mjs";
import { generateManifest, generateReadme } from "./generator.mjs";

const HOST = "127.0.0.1";
const START_PORT = Number(process.env.ANIMATION_CREATOR_PORT ?? 4173);
const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;
const MAX_FRAMES = 2000;
const JOB_TTL_MS = 60 * 60 * 1000;
const PUBLIC_DIR = path.join(import.meta.dirname, "public");
const PRISM_DIR = path.join(import.meta.dirname, "..", "..", "node_modules", "prismjs");
const VENDOR_FILES = {
	"/vendor/prism.js": path.join(PRISM_DIR, "prism.js"),
	"/vendor/prism-ini.js": path.join(PRISM_DIR, "components/prism-ini.min.js")
};
const JOBS_ROOT = await fs.mkdtemp(path.join(os.tmpdir(), "bf-animation-creator-"));
const jobs = new Map();

function json(response, status, value) {
	response.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store"
	});
	response.end(JSON.stringify(value));
}

async function readBody(request, maxBytes = 1024 * 1024) {
	const chunks = [];
	let size = 0;
	for await (const chunk of request) {
		size += chunk.length;
		if (size > maxBytes)
			throw Object.assign(new Error("Request is too large."), { status: 413 });
		chunks.push(chunk);
	}
	return Buffer.concat(chunks);
}

async function readJson(request) {
	const body = await readBody(request);
	try {
		return JSON.parse(body.toString("utf8"));
	} catch {
		throw Object.assign(new Error("Invalid JSON request."), { status: 400 });
	}
}

function getJob(id) {
	const job = jobs.get(id);
	if (!job)
		throw Object.assign(new Error("Animation job was not found or has expired."), {
			status: 404
		});
	job.touchedAt = Date.now();
	return job;
}

async function createJob() {
	const id = crypto.randomUUID();
	const directory = path.join(JOBS_ROOT, id);
	await fs.ensureDir(path.join(directory, "sources"));
	const job = { id, directory, sources: {}, preview: null, touchedAt: Date.now() };
	jobs.set(id, job);
	return job;
}

function safeFilename(value) {
	const decoded = decodeURIComponent(value || "source");
	if (path.basename(decoded) !== decoded || decoded.includes("\0"))
		throw Object.assign(new Error("Invalid source filename."), { status: 400 });
	const extension = path.extname(decoded).toLowerCase();
	if (!SUPPORTED_EXTENSIONS.includes(extension))
		throw Object.assign(new Error(`Unsupported media type: ${extension || "none"}.`), {
			status: 415
		});
	return { name: decoded, extension };
}

async function uploadSource(request, response, job, slot) {
	if (!["plain", "full", "empty"].includes(slot))
		throw Object.assign(new Error("Invalid source slot."), { status: 400 });
	const filename = safeFilename(request.headers["x-file-name"]);
	const body = await readBody(request, MAX_UPLOAD_BYTES);
	if (!body.length)
		throw Object.assign(new Error("The uploaded file is empty."), { status: 400 });
	const staging = path.join(
		job.directory,
		"sources",
		`${slot}-${crypto.randomUUID()}.upload${filename.extension}`
	);
	const target = path.join(job.directory, "sources", `${slot}${filename.extension}`);
	let metadata;
	try {
		await fs.writeFile(staging, body);
		metadata = await probeMedia(staging);
		const previous = job.sources[slot];
		await fs.move(staging, target, { overwrite: true });
		if (previous && previous.path !== target) await fs.remove(previous.path);
	} catch (error) {
		await fs.remove(staging);
		throw error;
	}
	job.sources[slot] = { path: target, name: filename.name, metadata };
	job.preview = null;
	json(response, 200, { slot, name: filename.name, metadata });
}

async function generatePreview(response, job, rawConfig) {
	const config = normalizeCreatorConfig(rawConfig);
	const slots = requiredSlots(config.category, config.layout);
	for (const slot of slots)
		if (!job.sources[slot])
			throw Object.assign(new Error(`Upload the ${slot} source first.`), { status: 400 });
	const sourceNames = Object.fromEntries(slots.map(slot => [slot, job.sources[slot].name]));
	const hash = hashConfiguration(config, sourceNames);
	const previewRoot = path.join(job.directory, "preview");
	await fs.remove(previewRoot);
	const results = {};
	try {
		for (const slot of slots) {
			results[slot] = await extractFrames({
				input: job.sources[slot].path,
				outputDir: path.join(previewRoot, slot),
				maxFrames: MAX_FRAMES,
				fps: config.fps,
				width: config.width,
				height: config.height,
				mode: config.mode,
				position: config.position,
				...config.sources[slot]
			});
		}
		const counts = slots.map(slot => results[slot].frameCount);
		if (config.layout === "paired" && new Set(counts).size !== 1)
			throw new Error(
				`Paired sources must have equal frame counts. Full produced ${results.full.frameCount}; empty produced ${results.empty.frameCount}.`
			);
		const frameCount = counts[0];
		const steps = expandPlayback(config.playback, frameCount);
		job.preview = {
			hash,
			config: { ...config, fps: results[slots[0]].fps },
			slots,
			results,
			frameCount,
			steps,
			sourceNames
		};
		json(response, 200, {
			hash,
			frameCount,
			stepCount: steps.length,
			steps,
			slots,
			width: results[slots[0]].width,
			height: results[slots[0]].height,
			fps: results[slots[0]].fps,
			manifest: generateManifest(job.preview.config, frameCount, steps),
			manifestPath: `media/BF/animations/${job.preview.config.name}.txt`,
			assetPath: `${job.preview.config.outputPath}/${job.preview.config.name}`,
			layout: job.preview.config.layout
		});
	} catch (error) {
		await fs.remove(previewRoot);
		job.preview = null;
		throw error;
	}
}

async function sendFrame(response, job, slot, frame, previewHash) {
	if (
		!job.preview ||
		!job.preview.slots.includes(slot) ||
		!/^\d+$/.test(frame) ||
		job.preview.hash !== previewHash
	)
		throw Object.assign(new Error("Preview frame was not found."), { status: 404 });
	const index = Number(frame);
	if (index >= job.preview.frameCount)
		throw Object.assign(new Error("Preview frame was not found."), { status: 404 });
	response.writeHead(200, {
		"content-type": "image/png",
		"cache-control": "no-store"
	});
	fs.createReadStream(path.join(job.directory, "preview", slot, `${index}.png`)).pipe(response);
}

async function downloadZip(response, job, requestedHash) {
	if (!job.preview || job.preview.hash !== requestedHash)
		throw Object.assign(new Error("Generate a current preview before downloading."), {
			status: 409
		});
	const { config, frameCount, slots, sourceNames } = job.preview;
	response.writeHead(200, {
		"content-type": "application/zip",
		"content-disposition": `attachment; filename="${config.name}.zip"`
	});
	const archive = archiver("zip", { zlib: { level: 9 } });
	archive.on("error", error => response.destroy(error));
	archive.pipe(response);
	for (const slot of slots) {
		const base = `${config.outputPath}/${config.name}`;
		const destination = slot === "plain" ? base : `${base}/${slot}`;
		archive.directory(path.join(job.directory, "preview", slot), destination);
	}
	archive.append(generateManifest(config, frameCount, job.preview.steps), {
		name: `media/BF/animations/${config.name}.txt`
	});
	archive.append(generateReadme(config, frameCount, job.preview.steps), { name: "README.md" });
	archive.append(
		JSON.stringify({ generatorVersion: 1, config, frameCount, sources: sourceNames }, null, 2),
		{ name: "animation-creator.json" }
	);
	await archive.finalize();
}

async function serveStatic(response, pathname) {
	if (VENDOR_FILES[pathname]) {
		response.writeHead(200, {
			"content-type": "text/javascript; charset=utf-8",
			"cache-control": "private, max-age=3600"
		});
		fs.createReadStream(VENDOR_FILES[pathname]).pipe(response);
		return true;
	}
	const file = pathname === "/" ? "index.html" : pathname.slice(1);
	if (!["index.html", "app.js", "styles.css"].includes(file)) return false;
	const types = {
		".html": "text/html; charset=utf-8",
		".js": "text/javascript; charset=utf-8",
		".css": "text/css; charset=utf-8"
	};
	response.writeHead(200, {
		"content-type": types[path.extname(file)],
		"cache-control": "no-store"
	});
	fs.createReadStream(path.join(PUBLIC_DIR, file)).pipe(response);
	return true;
}

const server = http.createServer(async (request, response) => {
	try {
		const url = new URL(request.url, `http://${HOST}`);
		if (request.method === "GET" && (await serveStatic(response, url.pathname))) return;
		if (request.method === "POST" && url.pathname === "/api/jobs") {
			const job = await createJob();
			return json(response, 201, { jobId: job.id });
		}
		const upload = url.pathname.match(
			/^\/api\/jobs\/([a-f0-9-]+)\/sources\/(plain|full|empty)$/
		);
		if (request.method === "POST" && upload)
			return await uploadSource(request, response, getJob(upload[1]), upload[2]);
		const preview = url.pathname.match(/^\/api\/jobs\/([a-f0-9-]+)\/preview$/);
		if (request.method === "POST" && preview)
			return await generatePreview(response, getJob(preview[1]), await readJson(request));
		const frame = url.pathname.match(
			/^\/api\/jobs\/([a-f0-9-]+)\/frames\/(plain|full|empty)\/(\d+)$/
		);
		if (request.method === "GET" && frame)
			return await sendFrame(
				response,
				getJob(frame[1]),
				frame[2],
				frame[3],
				url.searchParams.get("hash")
			);
		const download = url.pathname.match(/^\/api\/jobs\/([a-f0-9-]+)\/download$/);
		if (request.method === "GET" && download)
			return await downloadZip(response, getJob(download[1]), url.searchParams.get("hash"));
		const remove = url.pathname.match(/^\/api\/jobs\/([a-f0-9-]+)$/);
		if (request.method === "DELETE" && remove) {
			const job = getJob(remove[1]);
			jobs.delete(job.id);
			await fs.remove(job.directory);
			return json(response, 200, { deleted: true });
		}
		json(response, 404, { error: "Not found." });
	} catch (error) {
		if (!response.headersSent)
			json(response, error.status ?? 500, {
				error: error.message ?? "Unexpected server error."
			});
		else response.destroy(error);
	}
});

const expiryTimer = setInterval(async () => {
	const cutoff = Date.now() - JOB_TTL_MS;
	for (const [id, job] of jobs)
		if (job.touchedAt < cutoff) {
			jobs.delete(id);
			await fs.remove(job.directory);
		}
}, 60_000);
expiryTimer.unref();

async function cleanup() {
	clearInterval(expiryTimer);
	await fs.remove(JOBS_ROOT);
}
for (const signal of ["SIGINT", "SIGTERM"])
	process.once(signal, () => server.close(() => cleanup().finally(() => process.exit(0))));

let port = START_PORT;
server.on("error", error => {
	if (error.code === "EADDRINUSE" && port < START_PORT + 20) {
		port += 1;
		server.listen(port, HOST);
	} else {
		console.error(error);
		process.exitCode = 1;
	}
});
server.on("listening", () => console.log(`Animation Creator: http://${HOST}:${port}`));
server.listen(port, HOST);
