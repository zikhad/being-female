import crypto from "node:crypto";

export const CATEGORIES = ["intercourse", "birth", "fertilization"];
export const LAYOUTS = ["plain", "full", "empty", "paired"];
export const PLAYBACK_PATTERNS = ["forward", "reverse", "pingpong", "hold", "custom"];
const MAX_PLAYBACK_STEPS = 10000;

/** Convert a user-provided name into a safe animation folder slug. */
export function slugifyName(value) {
	const slug = String(value ?? "")
		.trim()
		.toLowerCase()
		.replace(/\s+/g, "-")
		.replace(/[^a-z0-9_-]/g, "")
		.replace(/-+/g, "-");
	if (!slug) throw new Error("Animation name must contain a letter or number.");
	if (slug.length > 80) throw new Error("Animation name must be 80 characters or fewer.");
	return slug;
}

/** Return the source slots required by an animation category and layout. */
export function requiredSlots(category, layout) {
	if (category !== "intercourse") return ["plain"];
	if (layout === "paired") return ["full", "empty"];
	return [layout];
}

/** Normalize web creator configuration and reject contradictory settings. */
export function normalizeCreatorConfig(input = {}) {
	const category = input.category ?? "intercourse";
	if (!CATEGORIES.includes(category)) throw new Error("Unknown animation category.");
	let layout = input.layout ?? "plain";
	if (!LAYOUTS.includes(layout)) throw new Error("Unknown animation layout.");
	if (category !== "intercourse") layout = "plain";
	const loop = Number(input.loop ?? 1);
	if (!Number.isInteger(loop) || loop < 1 || loop > 1000)
		throw new Error("Loop count must be an integer between 1 and 1000.");
	const outputPath = String(input.outputPath ?? "media/ui/animation").replace(/^\/+|\/+$/g, "");
	if (
		!outputPath.startsWith("media/ui/") ||
		outputPath.includes("..") ||
		!/^[a-zA-Z0-9_./-]+$/.test(outputPath)
	)
		throw new Error("Output path must be a safe relative path under media/ui.");
	const sources = {};
	for (const slot of requiredSlots(category, layout)) {
		const trim = input.sources?.[slot] ?? {};
		sources[slot] = {
			startTime: trim.startTime || "00:00:00",
			endTime: trim.endTime || undefined
		};
	}
	return {
		name: slugifyName(input.name),
		category,
		layout,
		loop,
		outputPath,
		pregnancy: category === "intercourse" && Boolean(input.pregnancy),
		condom: category === "intercourse" && Boolean(input.condom),
		fps: input.fps ?? 5,
		width: input.width ?? undefined,
		height: input.height ?? undefined,
		mode: input.mode ?? "fill",
		position: input.position ?? "center",
		playback: normalizePlayback(input.playback),
		sources
	};
}

/** Normalize playback-sequence controls before configuration hashing and expansion. */
export function normalizePlayback(input = {}) {
	const mode = input.mode ?? "simple";
	if (!["simple", "custom"].includes(mode)) throw new Error("Unknown playback mode.");
	if (mode === "simple") return { mode, segments: [] };
	if (!Array.isArray(input.segments) || input.segments.length === 0)
		throw new Error("Add at least one playback segment.");
	if (input.segments.length > 100) throw new Error("Playback supports at most 100 segments.");
	return {
		mode,
		segments: input.segments.map((segment, index) => {
			const pattern = segment.pattern ?? "forward";
			if (!PLAYBACK_PATTERNS.includes(pattern))
				throw new Error(`Playback segment ${index + 1} has an unknown pattern.`);
			const repeats = Number(segment.repeats ?? 1);
			if (!Number.isInteger(repeats) || repeats < 1 || repeats > 1000)
				throw new Error(
					`Playback segment ${index + 1} repeats must be between 1 and 1000.`
				);
			return {
				pattern,
				start:
					segment.start === "" || segment.start === undefined ? 0 : Number(segment.start),
				end: segment.end === "" || segment.end === undefined ? null : Number(segment.end),
				repeats,
				steps: String(segment.steps ?? "")
			};
		})
	};
}

/** Expand visual playback segments into validated zero-based PNG frame indices. */
export function expandPlayback(playback, frameCount) {
	if (!Number.isInteger(frameCount) || frameCount < 1)
		throw new Error("Playback requires at least one extracted frame.");
	if (playback.mode === "simple") return Array.from({ length: frameCount }, (_, index) => index);
	const expanded = [];
	for (const [index, segment] of playback.segments.entries()) {
		let sequence;
		if (segment.pattern === "custom") {
			if (!segment.steps.trim())
				throw new Error(`Playback segment ${index + 1} needs frame steps.`);
			sequence = segment.steps.split(",").map(value => {
				const normalized = value.trim();
				if (!/^\d+$/.test(normalized))
					throw new Error(`Playback segment ${index + 1} has an invalid frame step.`);
				return Number(normalized);
			});
		} else {
			const start = segment.start;
			const end = segment.end ?? frameCount - 1;
			if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start)
				throw new Error(`Playback segment ${index + 1} has an invalid frame range.`);
			if (segment.pattern === "hold") sequence = [start];
			else {
				const forward = Array.from(
					{ length: end - start + 1 },
					(_, offset) => start + offset
				);
				if (segment.pattern === "forward") sequence = forward;
				if (segment.pattern === "reverse") sequence = forward.reverse();
				if (segment.pattern === "pingpong")
					sequence = [...forward, ...forward.slice(1, -1).reverse()];
			}
		}
		if (
			!sequence?.length ||
			sequence.some(frame => !Number.isInteger(frame) || frame < 0 || frame >= frameCount)
		)
			throw new Error(
				`Playback segment ${index + 1} references a frame outside 0-${frameCount - 1}.`
			);
		for (let repeat = 0; repeat < segment.repeats; repeat++) {
			if (expanded.length + sequence.length > MAX_PLAYBACK_STEPS)
				throw new Error(`Playback cannot exceed ${MAX_PLAYBACK_STEPS} expanded steps.`);
			expanded.push(...sequence);
		}
	}
	return expanded;
}

/** Produce a stable hash used to prove that a preview matches the current configuration. */
export function hashConfiguration(config, sourceNames) {
	return crypto
		.createHash("sha256")
		.update(JSON.stringify({ config, sourceNames }))
		.digest("hex");
}

/** Map a layout to the AnimationSetting fullnessSupport value. */
export function fullnessSupport(category, layout) {
	if (category !== "intercourse" || layout === "plain") return [];
	return layout === "paired" ? ["full", "empty"] : [layout];
}
