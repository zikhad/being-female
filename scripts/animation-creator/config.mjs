import crypto from "node:crypto";

export const CATEGORIES = ["intercourse", "birth", "fertilization"];
export const LAYOUTS = ["plain", "full", "empty", "paired"];

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
	if (!outputPath || outputPath.includes("..") || !/^[a-zA-Z0-9_./-]+$/.test(outputPath))
		throw new Error("Output path is invalid.");
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
		sources
	};
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
