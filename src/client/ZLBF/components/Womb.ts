import { CyclePhase, PregnancyData, WombData } from "@types";
import {
	BodyPartType,
	getText,
	IsoPlayer,
	triggerEvent,
	ZombRand,
	ZombRandFloat
} from "@asledgehammer/pipewrench";
import { WombOptions } from "@client/SandboxOptions";
import * as Events from "@asledgehammer/pipewrench-events";
import { Player, TimedEvents } from "@client/components/Player";
import { CyclePhaseEnum, ITEMS, ZLBFEventsEnum, ZLBFTraitsEnum } from "@constants";
import { PregnancyState } from "@client/components/PregnancyState";
import { percentageToNumber, trimModuleName } from "@client/Utils";

/**
 * Manages reproductive functions, fertility, and pregnancy-related variables
 * for a player character in the game. Handles cycle tracking, fertility logic.
 */
export class Womb extends Player<WombData> implements TimedEvents {
	private readonly CONSTANTS = {
		fertilityLevel: 5
	};
	private readonly options = {
		recovery: WombOptions.recovery,
		capacity: WombOptions.capacity
	};

	set amount(value: number) {
		this.data!.amount = value;
	}

	get amount() {
		return this.data?.amount ?? 0;
	}

	get capacity() {
		return this.data?.capacity ?? this.options.capacity;
	}

	public Debug = {
		sperm: {
			add: (amount: number) => {
				this.amount = Math.min(this.options.capacity, this.amount + amount);
				this.total += amount;
			},
			remove: (amount: number) => (this.amount = Math.max(0, this.amount - amount)),
			set: (amount: number) => (this.amount = amount),
			setTotal: (amount: number) => (this.total = Math.max(0, amount))
		},
		cycle: {
			addDay: (amount = 1) => {
				this.contraceptive = false;
				// handle recovery days
				if (this.cycleDay < 0) {
					this.cycleDay++;
				} else {
					this.cycleDay = Math.max(1, (this.cycleDay + amount) % 29);
				}
			},
			nextPhase: () => {
				if (this.pregnancy) return;
				if (this.cycleDay < 1) {
					this.cycleDay = 1;
				} else if (this.cycleDay < 6) {
					this.cycleDay = 6;
				} else if (this.cycleDay < 13) {
					this.cycleDay = 13;
				} else if (this.cycleDay < 16) {
					this.cycleDay = 16;
				} else if (this.cycleDay < 28) {
					this.cycleDay = 28;
				} else {
					this.cycleDay = 1;
				}
				this.contraceptive = false;
			}
		}
	};

	defaultData = {
		capacity: this.options.capacity,
		amount: 0,
		total: 0,
		cycleDay: ZombRand(1, 28),
		onContraceptive: false,
		chances: Womb.chances,
		fertility: 0
	};

	// === Property Accessors ===

	/**
	 * Generates randomized fertility chances for each cycle phase.
	 */
	static get chances(): Record<CyclePhase, number> {
		return {
			[CyclePhaseEnum.PREGNANT]: 0,
			[CyclePhaseEnum.RECOVERY]: 0,
			[CyclePhaseEnum.MENSTRUATION]: ZombRandFloat(0, 0.3),
			[CyclePhaseEnum.FOLLICULAR]: ZombRandFloat(0, 0.4),
			[CyclePhaseEnum.OVULATION]: ZombRandFloat(0.85, 1),
			[CyclePhaseEnum.LUTEAL]: ZombRandFloat(0, 0.3)
		};
	}

	set contraceptive(value: boolean) {
		this.data!.onContraceptive = value;
	}

	get contraceptive() {
		return this.data?.onContraceptive ?? false;
	}

	set cycleDay(value: number) {
		this.data!.cycleDay = value;
	}

	get cycleDay() {
		return this.data?.cycleDay ?? 0;
	}

	set total(value: number) {
		this.data!.total = value;
	}
	get total() {
		return this.data?.total ?? 0;
	}

	private set fertility(value: number) {
		this.data!.fertility = value;
	}

	get fertility() {
		return this.data?.fertility ?? 0;
	}

	get fertilityLevelStatus() {
		switch (this.phase) {
			case CyclePhaseEnum.RECOVERY:
				return "recovery";
			case CyclePhaseEnum.PREGNANT:
				if ((this.pregnancy?.progress ?? 0) >= 0.05) {
					return "pregnant";
				}
				return "fertilized";
			default:
				return percentageToNumber(this.fertility * 100, this.CONSTANTS.fertilityLevel);
		}
	}

	get phase() {
		return this.getCyclePhase(this.cycleDay);
	}

	get phaseTranslation() {
		return {
			[CyclePhaseEnum.RECOVERY]: "IGUI_ZLBF_UI_Recovery",
			[CyclePhaseEnum.MENSTRUATION]: "IGUI_ZLBF_UI_Menstruation",
			[CyclePhaseEnum.FOLLICULAR]: "IGUI_ZLBF_UI_Follicular",
			[CyclePhaseEnum.OVULATION]: "IGUI_ZLBF_UI_Ovulation",
			[CyclePhaseEnum.LUTEAL]: "IGUI_ZLBF_UI_Luteal",
			[CyclePhaseEnum.PREGNANT]: "IGUI_ZLBF_UI_Pregnant"
		}[this.phase];
	}

	/**
	 * Initializes the Womb system.
	 */
	constructor() {
		super("ZLBFWomb");
	}

	/**
	 * Initializes data when the player is created.
	 * @param player - The IsoPlayer instance.
	 */
	onCreatePlayer(player: IsoPlayer) {
		super.onCreatePlayer(player);
		this.amount = this.data?.amount ?? 0;

		Events.everyOneMinute.addListener(() => this.onEveryMinute());
		Events.everyTenMinutes.addListener(() => this.onEveryTenMinutes());
		Events.everyDays.addListener(() => this.onEveryDay());
		new Events.EventEmitter<(data: PregnancyData) => void>(
			ZLBFEventsEnum.PREGNANCY_UPDATE
		).addListener(data => this.onPregnancyUpdate(data));

		new Events.EventEmitter(ZLBFEventsEnum.INTERCOURSE).addListener(() => this.intercourse());
		new Events.EventEmitter(ZLBFEventsEnum.MENSTRUAL_EFFECTS).addListener(() =>
			this.menstruationEffects()
		);
	}

	public get pregnancy(): PregnancyData | null {
		return PregnancyState.get(this.player);
	}

	private intercourse() {
		if (!this.player) return;
		const amountInMilliliters = ZombRand(10, 50);
		const amount = amountInMilliliters / 1000;
		this.haloText({
			text: `${getText("IGUI_ZLBF_UI_Sperm")} ${amountInMilliliters} ml`,
			style: "good"
		});
		if (this.hasItem(ITEMS.CONDOM)) {
			const inventory = this.player.getInventory();
			inventory.Remove(trimModuleName(ITEMS.CONDOM)); // for whichever reason the remove method doesn't work with the module.name of the item.
			inventory.AddItem(ITEMS.CONDOM_USED);
		} else {
			this.amount += amount;
			this.total += amount;
			if (!this.pregnancy) this.impregnate();
		}
	}

	private impregnate() {
		if (this.fertility <= 0) return;
		if (ZombRandFloat(0, 1) >= 1 - this.fertility) {
			this.haloText({
				text: getText("IGUI_ZLBF_UI_Fertilized"),
				style: "good"
			});
			triggerEvent(ZLBFEventsEnum.PREGNANCY_START);
		}
	}

	/**
	 * Updates cycle based on pregnancy progress.
	 * @param data - Pregnancy data.
	 */
	onPregnancyUpdate(data: PregnancyData) {
		if (!this.pregnancy) return;

		this.cycleDay = -this.options.recovery;
		if (data.progress > 0.5) {
			this.amount = 0;
		}
	}

	onEveryMinute(): void {
		this.fertility = this.computeFertility();
		triggerEvent(ZLBFEventsEnum.WOMB_UPDATE, this.data);
	}

	onEveryTenMinutes(): void {
		// do nothing if empty
		if (this.amount <= 0) return;

		const amount = ZombRand(0, 5) / 1000;
		this.amount -= Math.min(this.amount, amount);
		this.applyWetness();
	}

	onEveryDay(): void {
		// Increment cycle day
		this.cycleDay++;

		// Remove contraceptive effect
		this.contraceptive = false;

		this.data!.chances = Womb.chances;
		if (
			this.phase == CyclePhaseEnum.MENSTRUATION &&
			!this.hasTrait(ZLBFTraitsEnum.NO_MENSTRUAL_CRAMPS)
		) {
			this.menstruationEffects();
		}
	}

	/**
	 * Compute additional fertility bonus contributed by player traits.
	 * @returns Bonus multiplier to add to base fertility (0-1)
	 */
	private computeFertilityBonus() {
		if (this.hasTrait(ZLBFTraitsEnum.FERTILE)) return 0.25;
		if (this.hasTrait(ZLBFTraitsEnum.HYPERFERTILE)) return 0.5;
		return 0;
	}

	/**
	 * Computes fertility value based on traits and state.
	 * @returns Fertility chance between 0 and 1.
	 */
	private computeFertility() {
		const isInfetile = this.hasTrait(ZLBFTraitsEnum.INFERTILE);
		if (!this.data || isInfetile || this.contraceptive || this.pregnancy) {
			return 0;
		}

		const chance = this.data.chances[this.phase];
		const bonus = this.computeFertilityBonus();

		return Math.min(1, chance * (1 + bonus));
	}

	/**
	 * Determines the current cycle phase based on day.
	 * @param day - The current cycle day.
	 */
	private getCyclePhase(day: number): CyclePhase {
		if (this.pregnancy) return CyclePhaseEnum.PREGNANT;
		if (day < 1) return CyclePhaseEnum.RECOVERY;
		if (day < 6) return CyclePhaseEnum.MENSTRUATION;
		if (day < 13) return CyclePhaseEnum.FOLLICULAR;
		if (day < 16) return CyclePhaseEnum.OVULATION;
		return CyclePhaseEnum.LUTEAL;
	}

	/** Applies wetness effects */
	private applyWetness() {
		const amount = ZombRand(10, 100);
		this.applyBodyEffect(BodyPartType.Groin, { wetness: amount });
	}

	/** Apply menstrual effects like bleeding and pain */
	private menstruationEffects() {
		const hasStrongCramps = this.hasTrait(ZLBFTraitsEnum.STRONG_MENSTRUAL_CRAMPS);
		this.applyBodyEffect(BodyPartType.Groin, {
			bleedTime: ZombRand(1, 5),
			pain: hasStrongCramps ? ZombRand(10, 25) : ZombRand(5, 15),
			maxPain: hasStrongCramps ? 50 : 25
		});
	}
}
