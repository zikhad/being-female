import { BodyPartType, IsoPlayer, ZombRand, ZombRandFloat } from "@asledgehammer/pipewrench";
import * as Events from "@asledgehammer/pipewrench-events";
import { LactationData, LactationImages, PregnancyData } from "@types";
import { percentageToNumber } from "@utils";
import { BFEventsEnum, BFTraitsEnum } from "@constants";
import { emitBFNotification } from "@client/LegacyEventCompatibility";
import { LactationOptions } from "@client/SandboxOptions";
import { Player, TimedEvents } from "@client/components/Player";
import { Moodle } from "@client/components/Moodles";
import { PregnancyState } from "@client/components/PregnancyState";
import { SnapshotStore } from "@client/components/network/SnapshotStore";
import type { BFSnapshot } from "@shared/BFProtocol";
import {
	LactationMutationIntent,
	LactationPublisher
} from "@client/components/network/LactationPublisher";

/**
 * Lactation management system for a player character.
 * Handles milk production, expiration, pregnancy influence,
 * and visual image resolution based on state.
 */
export class Lactation extends Player<LactationData> implements TimedEvents {
	private readonly _bottleAmount = 0.2;

	private moodle?: Moodle;
	private publicationSuppressed = false;

	private readonly CONSTANTS = {
		MAX_LEVEL: 5,
		AMOUNTS: {
			MIN: 0.002,
			MAX: 0.01
		}
	};

	private readonly options = {
		expiration: LactationOptions.expiration,
		capacity: LactationOptions.capacity
	};

	/**
	 * Debug utilities to modify internal milk data
	 */
	public Debug = {
		add: (amount: number) => {
			this.milkAmount += amount;
			this.publishState({ milkAmount: { mode: "delta", value: amount } });
		},
		remove: (amount: number) => {
			this.milkAmount -= amount;
			this.publishState({ milkAmount: { mode: "delta", value: -amount } });
		},
		set: (amount: number) => {
			this.milkAmount = amount;
			this.publishState({ milkAmount: { mode: "replace", value: this.milkAmount } });
		},
		toggle: (status: boolean) => this.toggle(status)
	};

	defaultData = {
		isActive: false,
		milkAmount: 0,
		expiration: this.options.expiration,
		multiplier: 0
	};

	/**
	 * Creates client Lactation simulation with optional authoritative convergence.
	 *
	 * @param snapshots Authoritative snapshot mirror used for recipe and progression acknowledgement.
	 * @param commands Complete-state publisher; omitted in isolated single-player-compatible use.
	 */
	constructor(
		private readonly snapshots?: SnapshotStore,
		private readonly commands?: LactationPublisher
	) {
		super("BFLactation");
		this.snapshots?.subscribe(snapshot => this.applyAuthoritativeSnapshot(snapshot));
	}

	/** Replaces local Lactation compatibility data after an authoritative acknowledgement. */
	private applyAuthoritativeSnapshot(snapshot: BFSnapshot): void {
		this.data = { ...(this.commands?.latestDesiredState ?? snapshot.domains.lactation) };
	}

	/** Publishes the complete current Lactation state after a local simulation mutation. */
	private publishState(intent: LactationMutationIntent): void {
		if (!this.publicationSuppressed && this.data)
			this.commands?.publishState({ ...this.data }, intent);
	}

	/**
	 * Applies a compound synchronous mutation while publishing only its final complete state.
	 * Public mutation methods retain immediate publication outside this boundary.
	 *
	 * @param mutate Mutation composed from existing Lactation operations.
	 */
	private applyMutation(mutate: () => void, intent: () => LactationMutationIntent): void {
		this.publicationSuppressed = true;
		mutate();
		this.publicationSuppressed = false;
		this.publishState(intent());
	}

	/**
	 * Initialize lactation component for the given player and register timed events.
	 * @param player The created IsoPlayer instance
	 */
	onCreatePlayer(player: IsoPlayer): void {
		super.onCreatePlayer(player);
		const snapshot = this.snapshots?.snapshot;
		if (snapshot) this.applyAuthoritativeSnapshot(snapshot);
		this.moodle = new Moodle({
			player,
			name: "Engorgement",
			type: "Bad",
			texture: "media/ui/Moodles/Engorgement.png",
			tresholds: [0.3, 0.6, 0.8, 0.9]
		});

		Events.everyOneMinute.addListener(() => this.onEveryMinute());
		Events.everyTenMinutes.addListener(() => this.onEveryTenMinutes());
		Events.everyHours.addListener(() => this.onEveryHour());

		new Events.EventEmitter<(data: PregnancyData) => void>(
			BFEventsEnum.PREGNANCY_UPDATE
		).addListener(data => this.onPregnancyUpdate(data));

		new Events.EventEmitter<(data: LactationData) => void>(
			BFEventsEnum.LACTATION_UPDATE
		).addListener(data => this.onLactationUpdate(data));
	}

	private get pregnancy(): PregnancyData | null {
		return PregnancyState.get(this.player);
	}

	onPregnancyUpdate(data: PregnancyData) {
		if (!this.pregnancy) return;

		const { progress } = data;
		if (progress < 0.5) return;
		this.applyMutation(
			() => {
				this.toggle(true);
				this.useMilk(0, progress);
			},
			() => ({
				isActive: { mode: "replace", value: true },
				expiration: { mode: "replace", value: this.expiration },
				multiplier: { mode: "replace", value: this.multiplier }
			})
		);
	}

	onLactationUpdate(data: LactationData) {
		if (!this.isLactating) return;
		const multiplier = 1 + this.multiplier;
		const requested =
			ZombRandFloat(this.CONSTANTS.AMOUNTS.MIN, this.CONSTANTS.AMOUNTS.MAX) * multiplier;
		const previous = this.milkAmount;
		this.milkAmount = Math.min(this.capacity, previous + requested);
		const produced = this.milkAmount - previous;
		if (produced > 0) this.publishState({ milkAmount: { mode: "delta", value: produced } });
	}

	onEveryMinute() {
		this.commands?.onEveryOneMinute();
		this.moodle?.moodle(this.percentage, true);
		emitBFNotification(BFEventsEnum.LACTATION_UPDATE, this.data);
	}

	onEveryTenMinutes() {
		if (!this.isLactating) return;

		const modifier = percentageToNumber(this.percentage, 25);

		this.applyBodyEffect(BodyPartType.Torso_Upper, {
			pain: modifier,
			maxPain: 10,
			wetness: modifier
		});
	}

	onEveryHour() {
		if (!this.isLactating) return;
		const previousMultiplier = this.multiplier;
		const previousExpiration = this.expiration;
		this.multiplier = Math.max(0, this.multiplier - 0.1);
		this.expiration = Math.max(0, this.expiration - 1);

		// Apply moodle
		this.moodle?.moodle(this.percentage);

		if (this.expiration === 0) this.toggle(false);
		else
			this.publishState({
				multiplier: { mode: "delta", value: this.multiplier - previousMultiplier },
				expiration: { mode: "delta", value: this.expiration - previousExpiration }
			});
	}

	/**
	 * Toggles lactation on or off and resets data if needed
	 */
	public toggle(status: boolean) {
		this.isLactating = status;
		this.expiration = this.options.expiration;
		if (!status) {
			this.data = {
				isActive: false,
				expiration: this.options.expiration,
				milkAmount: 0,
				multiplier: 0
			};
			this.moodle?.moodle(0);
		}
		this.publishState({
			isActive: { mode: "replace", value: this.isLactating },
			expiration: { mode: "replace", value: this.expiration },
			milkAmount: status ? undefined : { mode: "replace", value: this.milkAmount },
			multiplier: status ? undefined : { mode: "replace", value: this.multiplier }
		});
	}

	/**
	 * Uses milk, applies multipliers based on traits
	 * @param amount - amount of milk to use
	 * @param multiplier - additional production multiplier
	 * @param expiration - override expiration value
	 */
	public useMilk(amount: number, multiplier?: number) {
		if (!this.data) return;

		amount = Math.min(amount, this.milkAmount);
		this.multiplier = Math.max(0, multiplier || 0);
		this.expiration = this.options.expiration;

		if (this.hasTrait(BFTraitsEnum.DAIRY_COW)) {
			this.multiplier *= 1.25;
			this.expiration *= 1.25;
		}

		this.remove(amount);
		this.publishState({
			milkAmount: { mode: "delta", value: -amount },
			expiration: { mode: "replace", value: this.expiration },
			multiplier: { mode: "replace", value: this.multiplier }
		});
	}

	/**
	 * Removes milk amount ensuring it doesn't go below 0
	 */
	private remove(amount: number) {
		this.milkAmount = Math.max(0, this.milkAmount - amount);
	}

	/**
	 * Gets the lactation image set depending on state
	 */
	get images(): LactationImages {
		const getState = () => {
			const progress = this.pregnancy?.progress ?? 0;
			if (progress < 0.4) return "normal";
			return `pregnant_${progress < 0.7 ? "early" : "late"}`;
		};

		const state = getState();
		const fullness = this.milkAmount > this.capacity / 2 ? "full" : "empty";
		const level = percentageToNumber(this.percentage, this.CONSTANTS.MAX_LEVEL);

		return {
			breasts: `media/ui/lactation/boobs/color-${this.skinColorIndex}/${state}_${fullness}.png`,
			level: `media/ui/lactation/level/milk_level_${level}.png`
		};
	}

	/** Milk percentage relative to capacity */
	get percentage() {
		return (this.milkAmount / this.capacity) * 100;
	}

	set isLactating(value: boolean) {
		this.data!.isActive = value;
	}
	/** Is the player currently lactating? */
	get isLactating() {
		return this.data?.isActive ?? false;
	}

	/** Maximum milk capacity */
	private get capacity() {
		return this.options.capacity;
	}

	/** Bottleable milk amount */
	get bottleAmount() {
		return this._bottleAmount;
	}

	/** Milk storage */
	private set milkAmount(amount: number) {
		this.data!.milkAmount = amount;
	}
	get milkAmount() {
		return this.data?.milkAmount ?? 0;
	}

	/** Multiplier that affects production */
	private set multiplier(value: number) {
		this.data!.multiplier = value;
	}
	get multiplier() {
		return this.data!.multiplier;
	}

	/** Time until spoilage in hours */
	private set expiration(value: number) {
		if (this.hasTrait(BFTraitsEnum.DAIRY_COW)) {
			this.data!.expiration = value * 1.25;
		}
		this.data!.expiration = value;
	}
	private get expiration() {
		return this.data!.expiration;
	}
}
