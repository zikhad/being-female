import { fullnessSupport } from "./config.mjs";

const quoteList = values => values.map(value => `"${value}"`).join(", ");

/** Generate a default Animation.ts variant object for the selected category. */
export function generateTypeScript(config, frameCount) {
	const lines = [
		`{`,
		`\tname: "${config.name}",`,
		`\tsteps: createArray(${frameCount}),`,
		`\tloop: ${config.loop},`
	];
	const fullness = fullnessSupport(config.category, config.layout);
	if (fullness.length) lines.push(`\tfullnessSupport: [${quoteList(fullness)}],`);
	if (config.category === "birth") lines.push("\tbirth: true,");
	if (config.category === "fertilization") lines.push("\tfertilization: true,");
	if (config.pregnancy) lines.push("\tpregnancy: true,");
	if (config.condom) lines.push("\tcondom: true,");
	if (config.outputPath !== "media/ui/animation") lines.push(`\tpath: "${config.outputPath}",`);
	lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, "");
	lines.push("}");
	return `// Add this object to Animation.defaultAnimations[ANIMATIONS.${config.category.toUpperCase()}].\n${lines.join("\n")}`;
}

/** Generate a Lua custom-animation event example for another mod. */
export function generateLua(config, frameCount) {
	const steps = Array.from({ length: frameCount }, (_, index) => index).join(", ");
	const fullness = fullnessSupport(config.category, config.layout);
	const fields = [
		`  name = "${config.name}",`,
		`  steps = { ${steps} },`,
		`  loop = ${config.loop},`
	];
	if (fullness.length) fields.push(`  fullnessSupport = { ${quoteList(fullness)} },`);
	fields.push(`  path = "${config.outputPath}"`);
	const stateWarning = ["full", "empty"].includes(config.layout)
		? `-- IMPORTANT: this package only contains ${config.layout}/ frames. Trigger it only when the womb is ${config.layout}.\n`
		: "";
	return `-- Custom settings are selected directly by this caller; BF default-variant filtering does not apply.\n${stateWarning}triggerEvent("BFWombAnimationStart", {\n${fields.join("\n")}\n})\n\n-- Call during the action update and stop lifecycles:\ntriggerEvent("BFWombAnimationUpdate", { delta = action:getJobDelta(), duration = action.maxTime })\ntriggerEvent("BFWombAnimationStop")`;
}

/** Build the human-readable instructions bundled with an exported animation. */
export function generateReadme(config, frameCount) {
	const stateWarning = ["full", "empty"].includes(config.layout)
		? `\nThis is a ${config.layout}-only intercourse package. External Lua callers must trigger it only when the womb is ${config.layout}; direct custom settings bypass BF's default variant filtering.\n`
		: "";
	return `# ${config.name}\n\nGenerated animation with ${frameCount} frame(s) at ${config.fps} FPS.\n\nCopy the \`${config.name}\` directory into your mod's \`${config.outputPath}\` directory. Use \`examples/animation.ts\` when registering a built-in BF variant, or \`examples/animation.lua\` when triggering it from another mod.\n${stateWarning}`;
}
