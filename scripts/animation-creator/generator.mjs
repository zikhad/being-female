import { fullnessSupport } from "./config.mjs";

/** Generate a BF animation manifest for data-driven registration or replacement. */
export function generateManifest(config, frameCount, steps) {
	const lines = [
		"# Place this file under media/BF/animations.",
		"# A later-loaded mod using the same relative manifest path replaces the definition.",
		"version=1",
		`name=${config.name}`,
		`category=${config.category}`,
		config.playback?.mode === "custom"
			? `steps=${steps.join(",")}`
			: `frameCount=${frameCount}`,
		`loop=${config.loop}`
	];
	const fullness = fullnessSupport(config.category, config.layout);
	if (fullness.length) lines.push(`fullness=${fullness.join(",")}`);
	if (config.pregnancy) lines.push("pregnancy=true");
	if (config.condom) lines.push("condom=true");
	if (config.outputPath !== "media/ui/animation") lines.push(`path=${config.outputPath}`);
	return `${lines.join("\n")}\n`;
}

/** Build the human-readable instructions bundled with an exported animation. */
export function generateReadme(config, frameCount, steps) {
	const assetPath = `${config.outputPath}/${config.name}`;
	const playbackDescription =
		config.playback?.mode === "custom"
			? ` Its manifest expands those images into ${steps.length} playback steps using the custom sequence configured in the creator.`
			: " Its manifest plays every frame once in order.";
	return `# ${config.name}\n\nThis package contains a BF animation with ${frameCount} frame(s), extracted at ${config.fps} FPS.${playbackDescription}\n\n## Install\n\n1. Open the target mod's \`42\` directory (for example, \`mod-name/42\`).\n2. Merge this package's \`media\` directory into \`mod-name/42/media\`.\n3. Keep the manifest at \`media/BF/animations/${config.name}.txt\`. BF discovers it when the game starts.\n4. Keep the PNG frames under \`${assetPath}/\`.\n5. Look for \`[BF][AnimationRegistry]\` in \`console.txt\` to confirm manifest loading.\n\n### Replacing animations\n\nA mod can replace a default BF animation. Make sure that mod loads after BF, then give its manifest the same filename as the BF animation being replaced. The replacement manifest must describe the complete animation.\n\n## Package Contents\n\n- \`media/BF/animations/${config.name}.txt\` — complete animation definition.\n- \`${assetPath}/\` — zero-based PNG frame sequence.\n- \`animation-creator.json\` — extraction settings and source filenames for reference only.\n`;
}
