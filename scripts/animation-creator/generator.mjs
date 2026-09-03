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
	const fullness = fullnessSupport(config.category, config.layout);
	const fields = [
		`  name = "${config.name}",`,
		`  steps = createArray(${frameCount}),`,
		`  loop = ${config.loop},`
	];
	if (fullness.length) fields.push(`  fullnessSupport = { ${quoteList(fullness)} },`);
	if (config.category === "birth") fields.push("  birth = true,");
	if (config.category === "fertilization") fields.push("  fertilization = true,");
	if (config.pregnancy) fields.push("  pregnancy = true,");
	if (config.condom) fields.push("  condom = true,");
	fields.push(`  path = "${config.outputPath}"`);
	return `-- Example utility: BF does not provide createArray as a global Lua function.\n-- It builds the zero-based frame indexes expected by AnimationSetting.steps.\nlocal function createArray(length)\n  local steps = {}\n  for index = 0, length - 1 do\n    steps[#steps + 1] = index\n  end\n  return steps\nend\n\n-- BF applies the AnimationSetting state flags before accepting this custom animation.\ntriggerEvent("BFWombAnimationStart", {\n${fields.join("\n")}\n})\n\n-- Call during the action update and stop lifecycles:\ntriggerEvent("BFWombAnimationUpdate", { delta = action:getJobDelta(), duration = action.maxTime })\ntriggerEvent("BFWombAnimationStop")`;
}

/** Build the human-readable instructions bundled with an exported animation. */
export function generateReadme(config, frameCount) {
	return `# ${config.name}\n\nGenerated animation with ${frameCount} frame(s) at ${config.fps} FPS.\n\nCopy the \`${config.name}\` directory into your mod's \`${config.outputPath}\` directory. Use \`examples/animation.ts\` when registering a built-in BF variant, or \`examples/animation.lua\` when triggering it from another mod. BF applies the custom setting's state flags, including \`fullnessSupport\`, before starting it.\n`;
}
