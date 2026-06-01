import {
	getActivatedMods,
	getTexture,
	getText,
	HaloTextHelper,
	IsoPlayer,
	require as pipeWrenchRequire
} from "@asledgehammer/pipewrench";
import { MODS } from "@constants";

type MoodleProps = {
	player: IsoPlayer;
	name: string;
	texture: string;
	type: "Good" | "Bad";
	tresholds: [number, number, number, number];
};
/**
 * Represents a custom moodle for a player, supporting both Moodle Framework (MF) and fallback HaloText.
 *
 * If Moodle Framework is active, moodles are registered and updated via MF APIs, and can be called more frequently for real-time updates.
 * If not, falls back to HaloText for one-off moodle notifications.
 */
export class Moodle {
	private isMF = false;
	private player: IsoPlayer;
	private name: string;
	private type: "Good" | "Bad";
	private texture?: ReturnType<typeof getTexture>;
	private tresholds: [number, number, number, number];

	/**
	 * Creates a new Moodle instance for a player.
	 *
	 * If Moodle Framework is active, registers the moodle and prepares it for frequent updates.
	 * Otherwise, prepares fallback logic using HaloText.
	 *
	 * @param props - Moodle configuration
	 */
	constructor(props: MoodleProps) {
		const { player, name, type, texture, tresholds } = props;
		this.player = player;
		this.name = name;
		this.type = type;
		this.tresholds = tresholds;
		if (getActivatedMods().contains(MODS.MOODLE_FRAMEWORK)) {
			this.isMF = true;
			pipeWrenchRequire("MF_ISMoodle");
			this.texture = getTexture(texture);
			MF.createMoodle(this.name);
			// Directly instantiate for the current player.
			// MF.createMoodle hooks OnCreatePlayer for future creates, but when this constructor
			// is called from within OnCreatePlayer (e.g. Lactation.onCreatePlayer), that event
			// has already fired and won't repeat — so we must create the moodle immediately.
			MF.ISMoodle.new(MF.ISMoodle, this.name, this.player);
		}
	}

	/**
	 * Method to fallback to `HaloText` when `MoodleFramework` is not active
	 * @param level number between 0-1
	 */
	private fallbackMoodle(level: number): void {
		level = Math.min(Math.max(level, 0), 1);
		// get a treshold from the tresholds, undefined if level not close enough
		const mapped = new Map([
			[this.tresholds[0], 1],
			[this.tresholds[1], 2],
			[this.tresholds[2], 3],
			[this.tresholds[3], 4]
		]).get(+level.toFixed(1));

		if (mapped) {
			const text = getText(`Moodles_${this.name}_${this.type}_desc_lvl${mapped}`);
			if (this.type === "Good") {
				HaloTextHelper.addGoodText(this.player, text);
				return;
			}
			HaloTextHelper.addBadText(this.player, text);
		}
	}

	/**
	 * Method to return array of arguments expecteed by `moodle.setTresholds`
	 * MF expects thresholds as `(bad4, bad3, bad2, bad1, good1, good2, good3, good4)`.
	 */
	private buildTresholds() {
		const [level1, level2, level3, level4] = this.tresholds;
		let bad4: number | undefined;
		let bad3: number | undefined;
		let bad2: number | undefined;
		let bad1: number | undefined;
		let good1: number | undefined;
		let good2: number | undefined;
		let good3: number | undefined;
		let good4: number | undefined;

		if (this.type === "Good") {
			good1 = level1;
			good2 = level2;
			good3 = level3;
			good4 = level4;
		} else {
			// MF bad moodles become worse as value goes down (`value <= badX`).
			// Our bad moodles (e.g. Engorgement) become worse as value goes up,
			// so thresholds are mirrored to the inverse value space.
			bad4 = 1 - level4;
			bad3 = 1 - level3;
			bad2 = 1 - level2;
			bad1 = 1 - level1;
		}

		return { bad4, bad3, bad2, bad1, good1, good2, good3, good4 };
	}

	/**
	 * Normalize an input level to a 0-1 range. Accepts either 0-1 or 0-100 inputs.
	 * @param level Input level value
	 * @returns Normalized level between 0 and 1
	 */
	private normalizeLevel(level: number): number {
		if (level > 1) {
			return level / 100;
		}

		return level;
	}

	/**
	 * Updates the moodle state for the player.
	 *
	 * If Moodle Framework is active, updates the moodle via MF APIs (can be called frequently for real-time updates).
	 * If not, falls back to a one-off HaloText notification.
	 *
	 * @param level - The moodle value (0-1 or 0-100, normalized internally)
	 * @param onlyMoodleFramework - If true, skips fallback and only attempts MF update
	 */
	public moodle(level: number, onlyMoodleFramework = false): void {
		const normalized = this.normalizeLevel(level);
		const mfLevel = this.type === "Bad" ? 1 - normalized : normalized;

		if (!this.isMF) {
			// If MF is not active, fallback to HaloText (one-off notification)
			if (!onlyMoodleFramework) {
				this.fallbackMoodle(normalized);
			}
			return;
		}

		// If MF is active, update moodle state (can be called frequently for real-time updates)
		const moodle = MF.getMoodle(this.name);
			if (!moodle) {
				if (!onlyMoodleFramework) {
					this.fallbackMoodle(normalized);
				}
				return;
			}
		const { bad4, bad3, bad2, bad1, good1, good2, good3, good4 } = this.buildTresholds();
		moodle.setThresholds(bad4, bad3, bad2, bad1, good1, good2, good3, good4);
		if (this.texture) {
			moodle.setPicture(moodle.getGoodBadNeutral(), moodle.getLevel(), this.texture);
		}
		moodle.setValue(mfLevel);
	}
}
