import { BodyPartType, getGameTime, IsoPlayer, ZombRandFloat } from "@asledgehammer/pipewrench";
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
import {
	applyMilkRemoval,
	clampStimulation,
	decayStimulation,
	lactationDuration,
	LACTATION_BALANCE,
	metabolicCostFor,
	requestedProduction
} from "@shared/domain/lactation/LactationBalance";

/**
 * Lactation management system for a player character.
 * Handles milk production, expiration, pregnancy influence,
 * and visual image resolution based on state.
 */
export class Lactation extends Player<LactationData> implements TimedEvents {
	private readonly _bottleAmount = 0.2;

	private moodle?: Moodle;
	private publicationSuppressed = false;
	private lastMinuteStamp?: number;

	private readonly CONSTANTS = {
		MAX_LEVEL: 5,
		AMOUNTS: {
			MIN: LACTATION_BALANCE.BASE_RATE_MIN,
			MAX: LACTATION_BALANCE.BASE_RATE_MAX
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
		const lactation = this.commands?.latestDesiredState ?? snapshot.domains.lactation;
		this.data = { ...lactation, multiplier: clampStimulation(lactation.multiplier) };
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
		this.lastMinuteStamp = getGameTime().getMinutesStamp();
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
	}

	/** Returns stored pregnancy data under a descriptor name unique to this component family. */
	private get pregnancyData(): PregnancyData | null {
		return PregnancyState.get(this.player);
	}

	onPregnancyUpdate(data: PregnancyData) {
		if (!this.pregnancyData) return;

		const { progress } = data;
		if (progress < 0.5) return;
		this.applyMutation(
			() => {
				this.toggle(true);
			},
			() => ({
				isActive: { mode: "replace", value: true },
				expiration: { mode: "replace", value: this.expiration }
			})
		);
	}

	/** Reconciles elapsed production, stimulation, expiration, and proportional metabolic costs. */
	onEveryMinute(): void {
		this.commands?.onEveryOneMinute();
		const minuteStamp = getGameTime().getMinutesStamp();
		const elapsed = Math.max(0, minuteStamp - (this.lastMinuteStamp ?? minuteStamp - 1));
		this.lastMinuteStamp = minuteStamp;
		if (this.isLactating && elapsed > 0) this.produce(elapsed);
		this.moodle?.moodle(this.percentage, true);
		emitBFNotification(BFEventsEnum.LACTATION_UPDATE, this.data);
	}

	/**
	 * Produces milk for elapsed game minutes and applies costs only to the clamped actual yield.
	 *
	 * @param elapsedMinutes Game minutes elapsed since the prior simulation callback.
	 */
	private produce(elapsedMinutes: number): void {
		const previousMilk = this.milkAmount;
		const previousMultiplier = this.multiplier;
		const previousExpiration = this.expiration;
		const activeMinutes = Math.min(elapsedMinutes, previousExpiration * 60);
		const hasDairyCow = this.hasTrait(BFTraitsEnum.DAIRY_COW);
		const requested = requestedProduction({
			baseRatePerMinute: ZombRandFloat(
				this.CONSTANTS.AMOUNTS.MIN,
				this.CONSTANTS.AMOUNTS.MAX
			),
			elapsedMinutes: activeMinutes,
			stimulation: previousMultiplier,
			hasDairyCow,
			thirst: this.getStatValue("THIRST"),
			hunger: this.getStatValue("HUNGER")
		});
		this.milkAmount = Math.min(this.capacity, previousMilk + requested);
		const produced = this.milkAmount - previousMilk;
		this.multiplier = decayStimulation(previousMultiplier, activeMinutes);
		this.expiration = Math.max(0, previousExpiration - elapsedMinutes / 60);

		if (produced > 0) {
			const cost = metabolicCostFor(produced);
			this.applyStatEffect({ stat: "THIRST", value: cost.thirst, maxValue: 1 });
			this.applyNutritionEffect({
				calories: -cost.calories,
				carbohydrates: -cost.carbohydrates,
				lipids: -cost.lipids,
				proteins: -cost.proteins
			});
		}

		const expired = this.expiration === 0;
		if (expired) {
			this.resetInactiveState();
			this.moodle?.moodle(0);
		}

		this.publishState({
			isActive: expired ? { mode: "replace", value: false } : undefined,
			milkAmount: expired
				? { mode: "replace", value: 0 }
				: { mode: "delta", value: this.milkAmount - previousMilk },
			expiration: expired
				? { mode: "replace", value: this.expiration }
				: { mode: "delta", value: this.expiration - previousExpiration },
			multiplier: expired
				? { mode: "replace", value: 0 }
				: { mode: "delta", value: this.multiplier - previousMultiplier }
		});
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

	onEveryHour(): void {
		if (!this.isLactating) return;
		this.moodle?.moodle(this.percentage);
	}

	/**
	 * Toggles lactation on or off and resets data if needed
	 */
	public toggle(status: boolean) {
		this.isLactating = status;
		this.expiration = this.refreshedDuration;
		if (!status) {
			this.resetInactiveState();
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
	 * Uses milk and converts actual removal into additive demand stimulation.
	 * @param amount - amount of milk to use
	 */
	public useMilk(amount: number): void {
		if (!this.data) return;

		const previousMilk = this.milkAmount;
		const previousMultiplier = this.multiplier;
		const next = applyMilkRemoval(this.data, amount, this.refreshedDuration);
		this.milkAmount = next.milkAmount;
		this.expiration = next.expiration;
		this.multiplier = next.multiplier;
		const removed = previousMilk - this.milkAmount;
		this.publishState({
			milkAmount: { mode: "delta", value: -removed },
			expiration: removed > 0 ? { mode: "replace", value: this.expiration } : undefined,
			multiplier: { mode: "delta", value: this.multiplier - previousMultiplier }
		});
	}

	/** Establishes the single complete persisted shape used whenever lactation is inactive. */
	private resetInactiveState(): void {
		this.isLactating = false;
		this.milkAmount = 0;
		this.expiration = this.options.expiration;
		this.multiplier = 0;
	}

	/** Returns the configured duration with Dairy Cow applied exactly once. */
	private get refreshedDuration(): number {
		return lactationDuration(this.options.expiration, this.hasTrait(BFTraitsEnum.DAIRY_COW));
	}

	/**
	 * Gets the lactation image set depending on state
	 */
	get images(): LactationImages {
		const getState = () => {
			const progress = this.pregnancyData?.progress ?? 0;
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

	/** Temporary recent-demand stimulation that affects production. */
	private set multiplier(value: number) {
		this.data!.multiplier = value;
	}
	get multiplier() {
		return this.data!.multiplier;
	}

	/** Remaining active lactation duration in hours. */
	private set expiration(value: number) {
		this.data!.expiration = value;
	}
	private get expiration() {
		return this.data!.expiration;
	}
}
