import { getActivatedMods, getModFileReader } from "@asledgehammer/pipewrench";
import * as Events from "@asledgehammer/pipewrench-events";
import { createArray } from "@client/Utils";

/** External identifiers for the animation families BF can trigger. */
export enum ANIMATIONS {
	INTERCOURSE = "intercourse",
	BIRTH = "birth",
	FERTILIZATION = "fertilization"
}

/** Defines one selectable image-sequence animation. */
export type AnimationSetting = {
	/** Display and asset-directory name. */
	name: string;
	/** Ordered zero-based frame indices. */
	steps: number[];
	/** Number of playback loops. */
	loop?: number;
	/** Intercourse fullness directories supported by this definition. */
	fullnessSupport?: ("full" | "empty")[];
	/** Whether this definition belongs to birth playback. */
	birth?: boolean;
	/** Whether this definition belongs to fertilization playback. */
	fertilization?: boolean;
	/** Required pregnancy state for intercourse playback. */
	pregnancy?: boolean;
	/** Required condom state for intercourse playback. */
	condom?: boolean;
	/** Base directory containing the named animation directory. */
	path?: string;
};

/** Maps each animation family to its selectable definitions. */
export type AnimationSettings = Record<ANIMATIONS, AnimationSetting[]>;

type ManifestValues = Record<string, string>;
type ManifestCandidate = { path: string; ownerModId: string };

const MANIFEST_DIRECTORY = "media/BF/animations";
const DEFAULT_IMAGE_PATH = "media/ui/animation";
const MAX_FRAME_COUNT = 10000;
const MAX_LOOP_COUNT = 1000;
const MANIFEST_KEYS = [
	"version",
	"name",
	"category",
	"frameCount",
	"steps",
	"loop",
	"fullness",
	"pregnancy",
	"condom",
	"path"
];

/** Owns built-in and virtual-filesystem-resolved external animation definitions. */
export class AnimationRegistry {
	/** Live category arrays retained by reference for backward compatibility. */
	readonly animations: AnimationSettings = {
		[ANIMATIONS.INTERCOURSE]: [],
		[ANIMATIONS.BIRTH]: [],
		[ANIMATIONS.FERTILIZATION]: []
	};

	private installed = false;

	/** Registers the manifest reload at the client game-start lifecycle. */
	install() {
		if (this.installed) return;
		this.installed = true;
		Events.onGameStart.addListener(() => this.reload());
	}

	/** Reloads all winning animation manifests from Project Zomboid's virtual filesystem. */
	reload() {
		const definitions: Record<string, { category: ANIMATIONS; setting: AnimationSetting }> = {};
		const candidatePaths = this.discoverManifestPaths();
		for (const candidate of candidatePaths) {
			const parsed = this.readManifest(candidate);
			if (parsed) definitions[candidate.path.toLowerCase()] = parsed;
		}

		this.clear();
		const manifestPaths = Object.keys(definitions).sort((left, right) => {
			const leftKey = this.manifestSortKey(left);
			const rightKey = this.manifestSortKey(right);
			if (leftKey < rightKey) return -1;
			if (leftKey > rightKey) return 1;
			return 0;
		});
		for (const manifestPath of manifestPaths) {
			const definition = definitions[manifestPath];
			this.animations[definition.category].push(definition.setting);
		}
		print(`[BF][AnimationRegistry] loaded ${Object.keys(definitions).length} manifests`);
	}

	/** Returns all currently registered variants for a family. */
	get(category: ANIMATIONS) {
		return this.animations[category];
	}

	/** Empties every live category array without replacing its shared reference. */
	private clear() {
		this.animations[ANIMATIONS.INTERCOURSE].splice(0);
		this.animations[ANIMATIONS.BIRTH].splice(0);
		this.animations[ANIMATIONS.FERTILIZATION].splice(0);
	}

	/** Resolves a direct manifest filename beneath BF's manifest directory. */
	private manifestPath(filename: string) {
		return `${MANIFEST_DIRECTORY}/${filename}`;
	}

	/** Sorts an unversioned base manifest before its hyphenated variants. */
	private manifestSortKey(manifestPath: string) {
		return manifestPath.endsWith(".txt")
			? `${manifestPath.substring(0, manifestPath.length - 4)}!.txt`
			: manifestPath;
	}

	/** Discovers and deduplicates manifest paths contributed by activated mods. */
	private discoverManifestPaths() {
		const paths: Record<string, ManifestCandidate> = {};
		try {
			const mods = getActivatedMods();
			for (let modIndex = 0; modIndex < mods.size(); modIndex++) {
				const filenames = listFilesInModDirectory(mods.get(modIndex), MANIFEST_DIRECTORY);
				for (let fileIndex = 0; fileIndex < filenames.size(); fileIndex++) {
					const filename = String(filenames.get(fileIndex));
					if (!filename.toLowerCase().endsWith(".txt")) continue;
					const path = this.manifestPath(filename);
					paths[path.toLowerCase()] = { path, ownerModId: mods.get(modIndex) };
				}
			}
		} catch (error) {
			print(`[BF][AnimationRegistry] manifest discovery failed: ${String(error)}`);
		}
		return Object.keys(paths)
			.sort()
			.map(path => paths[path]);
	}

	/** Reads and validates the last activated owner's manifest at a relative path. */
	private readManifest(candidate: ManifestCandidate) {
		let reader: ReturnType<typeof getModFileReader> | undefined;
		try {
			reader = getModFileReader(candidate.ownerModId, candidate.path, false);
			const values: ManifestValues = {};
			let rawLine = reader.readLine() as string | null;
			while (rawLine !== null) {
				const line = rawLine.trim();
				if (line.length > 0 && !line.startsWith("#") && !line.startsWith(";")) {
					const separator = line.indexOf("=");
					if (separator <= 0) throw new Error(`invalid line: ${line}`);
					const key = line.substring(0, separator).trim();
					if (values[key] !== undefined) throw new Error(`duplicate key: ${key}`);
					values[key] = line.substring(separator + 1, line.length).trim();
				}
				rawLine = reader.readLine() as string | null;
			}
			return this.normalizeManifest(values);
		} catch (error) {
			print(
				`[BF][AnimationRegistry] rejected ${candidate.path} from ${candidate.ownerModId}: ${String(error)}`
			);
			return undefined;
		} finally {
			if (reader) reader.close();
		}
	}

	/** Converts raw key/value fields into one runtime animation definition. */
	private normalizeManifest(values: ManifestValues) {
		for (const key of Object.keys(values)) {
			if (!MANIFEST_KEYS.includes(key)) throw new Error(`unknown key: ${key}`);
		}
		if (values.version !== "1") throw new Error("version must be 1");
		if (
			values.name === undefined ||
			!this.containsOnly(values.name, "abcdefghijklmnopqrstuvwxyz0123456789_-")
		)
			throw new Error("name must be a lowercase folder slug");

		const category = values.category as ANIMATIONS;
		if (!Object.values(ANIMATIONS).includes(category)) throw new Error("invalid category");

		const steps = this.parseSteps(values);
		const loop = this.parseInteger(values.loop ?? "1", "loop", 1, MAX_LOOP_COUNT);
		const path = values.path ?? DEFAULT_IMAGE_PATH;
		if (
			!path.startsWith("media/ui/") ||
			path.includes("..") ||
			!this.containsOnly(
				path,
				"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_./-"
			)
		)
			throw new Error("path must be a safe relative media/ui path");

		const fullnessSupport =
			values.fullness !== undefined
				? values.fullness.split(",").map(value => value.trim() as "full" | "empty")
				: undefined;
		if (fullnessSupport?.some(value => value !== "full" && value !== "empty"))
			throw new Error("fullness must contain only full and/or empty");
		if (category !== ANIMATIONS.INTERCOURSE && fullnessSupport)
			throw new Error("fullness is only valid for intercourse animations");
		if (
			category !== ANIMATIONS.INTERCOURSE &&
			(values.pregnancy !== undefined || values.condom !== undefined)
		)
			throw new Error("pregnancy and condom are only valid for intercourse animations");

		const setting: AnimationSetting = {
			name: values.name,
			steps,
			loop,
			path,
			fullnessSupport,
			birth: category === ANIMATIONS.BIRTH || undefined,
			fertilization: category === ANIMATIONS.FERTILIZATION || undefined
		};
		if (category === ANIMATIONS.INTERCOURSE) {
			setting.pregnancy = this.parseOptionalBoolean(values.pregnancy, "pregnancy");
			setting.condom = this.parseOptionalBoolean(values.condom, "condom");
		}
		return { category, setting };
	}

	/** Expands either a sequential frame count or an explicit step list. */
	private parseSteps(values: ManifestValues) {
		if (values.steps !== undefined && values.frameCount !== undefined)
			throw new Error("use steps or frameCount, not both");
		if (values.frameCount !== undefined) {
			return createArray(
				this.parseInteger(values.frameCount, "frameCount", 1, MAX_FRAME_COUNT)
			);
		}
		if (values.steps === undefined) throw new Error("steps or frameCount is required");
		const steps = values.steps
			.split(",")
			.map(value => this.parseInteger(value.trim(), "steps", 0, MAX_FRAME_COUNT - 1));
		if (steps.length === 0 || steps.length > MAX_FRAME_COUNT)
			throw new Error(`steps must contain 1-${MAX_FRAME_COUNT} entries`);
		return steps;
	}

	/** Parses a bounded non-negative manifest integer. */
	private parseInteger(value: string, key: string, minimum: number, maximum: number) {
		if (!this.containsOnly(value, "0123456789")) throw new Error(`${key} must be an integer`);
		const parsed = Number(value);
		if (parsed < minimum || parsed > maximum)
			throw new Error(`${key} must be between ${minimum} and ${maximum}`);
		return parsed;
	}

	/** Parses an optional strict lowercase boolean field. */
	private parseOptionalBoolean(value: string | undefined, key: string) {
		if (value === undefined) return undefined;
		if (value === "true") return true;
		if (value === "false") return false;
		throw new Error(`${key} must be true or false`);
	}

	/** Checks a string without regular expressions, which TypeScript-to-Lua cannot emit. */
	private containsOnly(value: string, allowed: string) {
		if (value.length === 0) return false;
		for (let index = 0; index < value.length; index++) {
			if (!allowed.includes(value.charAt(index))) return false;
		}
		return true;
	}
}

/** Shared client registry used by animation playback and manifest loading. */
export const animationRegistry = new AnimationRegistry();
