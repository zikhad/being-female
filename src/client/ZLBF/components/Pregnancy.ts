import type { PregnancyData } from "@types";
import { BodyPartType, IsoPlayer, triggerEvent, ZombRand } from "@asledgehammer/pipewrench";
import * as Events from "@asledgehammer/pipewrench-events";
import { ISTimedActionQueue } from "@asledgehammer/pipewrench/client";
import { ITEMS, ZLBFEventsEnum, ZLBFTraitsEnum } from "@constants";
import { ZLBFActionBirth } from "@actions/ZLBFBirth";
import { ZLBFActionPregnancyStartAnimation } from "@actions/ZLBFPregnancyStartAnimation";
import { Player, TimedEvents } from "@client/components/Player";
import { Moodle } from "@client/components/Moodles";
import { PregnancyState } from "@client/components/PregnancyState";
import { PregnancyOptions } from "@client/SandboxOptions";
import { PregnancyPublisher } from "@client/components/network/PregnancyPublisher";
import { SnapshotStore } from "@client/components/network/SnapshotStore";
import {
	AuthoritativePregnancyState,
	PregnancyStatus,
	createDefaultPregnancyState
} from "@shared/domain/pregnancy/PregnancyState";
import type { ZLBFSnapshot } from "@shared/ZLBFProtocol";

export class Pregnancy extends Player<PregnancyData> implements TimedEvents {
	private moodle?: Moodle;

	/**
	 * Get current pregnancy duration from sandbox options.
	 * This reads the value dynamically to respect runtime sandbox changes.
	 */
	private get duration(): number {
		return PregnancyOptions.duration;
	}

	/** Debug controls routed through the authoritative server Pregnancy command. */
	public Debug = {
		start: () => {
			this.commands?.setState({
				...createDefaultPregnancyState(),
				status: PregnancyStatus.PREGNANT
			});
		},
		stop: () => {
			this.commands?.setState(createDefaultPregnancyState());
		},
		advance: (minutes: number) => {
			const pregnancy = this.authoritativePregnancy;
			if (pregnancy.status !== PregnancyStatus.PREGNANT) return;

			const { current } = pregnancy;
			const duration = this.duration;
			const updated = Math.min(duration, current + minutes);
			this.commands?.setState({
				status: PregnancyStatus.PREGNANT,
				current: updated,
				progress: updated / duration,
				isInLabor: updated == duration
			});
		},
		advanceToLabor: () => {
			const pregnancy = this.authoritativePregnancy;
			if (pregnancy.status !== PregnancyStatus.PREGNANT) return;
			const { current } = pregnancy;
			const duration = this.duration;
			this.Debug.advance(duration - current - 1);
		}
	};

	/** Creates the Pregnancy component with optional authoritative network dependencies. */
	constructor(
		private readonly commands?: PregnancyPublisher,
		private readonly snapshots?: SnapshotStore
	) {
		super();
		this.snapshots?.subscribe(snapshot => this.applyAuthoritativeSnapshot(snapshot));
	}

	/** Returns the latest authoritative mirror, falling back to legacy local presentation state. */
	private get authoritativePregnancy(): AuthoritativePregnancyState {
		const authoritative = this.snapshots?.snapshot?.domains.pregnancy;
		if (authoritative) return authoritative;
		const local = PregnancyState.get(this.player);
		if (!local) return createDefaultPregnancyState();
		return {
			status: PregnancyStatus.PREGNANT,
			current: local.current,
			progress: local.progress,
			isInLabor: local.isInLabor ?? false
		};
	}

	/** Applies acknowledged authoritative Pregnancy state to legacy client presentation state. */
	private applyAuthoritativeSnapshot(snapshot: ZLBFSnapshot): void {
		const pregnancy = snapshot.domains.pregnancy;
		if (pregnancy.status === PregnancyStatus.NOT_PREGNANT) {
			this.removeTrait(ZLBFTraitsEnum.PREGNANCY);
			this.resetVariables();
			return;
		}

		this.addTrait(ZLBFTraitsEnum.PREGNANCY);
		PregnancyState.set(this.player, {
			current: pregnancy.current,
			progress: pregnancy.progress,
			isInLabor: pregnancy.isInLabor
		});
		this.moodle?.moodle(pregnancy.progress);
		triggerEvent(ZLBFEventsEnum.PREGNANCY_UPDATE, this.pregnancy);
	}

	protected onCreatePlayer(player: IsoPlayer): void {
		super.onCreatePlayer(player);
		PregnancyState.initialize(player);
		this.moodle = new Moodle({
			player,
			name: "Pregnancy",
			type: "Good",
			texture: "media/ui/Moodles/Pregnancy.png",
			tresholds: [0.3, 0.6, 0.8, 0.9]
		});
		const snapshot = this.snapshots?.snapshot;
		if (snapshot) this.applyAuthoritativeSnapshot(snapshot);
		Events.everyOneMinute.addListener(() => this.onEveryMinute());
		Events.everyHours.addListener(() => this.onEveryHour());
		Events.everyDays.addListener(() => this.onEveryDay());

		new Events.EventEmitter(ZLBFEventsEnum.PREGNANCY_START).addListener(() => this.start());
		new Events.EventEmitter(ZLBFEventsEnum.PREGNANCY_STOP).addListener(() => this.stop());
		new Events.EventEmitter<(delta: number) => void>(
			ZLBFEventsEnum.PREGNANCY_LABOR
		).addListener(delta => this.onLabor(delta));
	}

	/** Returns Pregnancy presentation data using authoritative status when synchronized. */
	public get pregnancy(): PregnancyData | null {
		const authoritative = this.snapshots?.snapshot?.domains.pregnancy;
		if (authoritative) {
			if (authoritative.status === PregnancyStatus.NOT_PREGNANT) return null;
			return (
				PregnancyState.getStored(this.player) ?? {
					current: authoritative.current,
					progress: authoritative.progress,
					isInLabor: authoritative.isInLabor
				}
			);
		}
		return PregnancyState.get(this.player);
	}

	/**
	 * Apply `default` values for `pregnancy` data
	 */
	private resetVariables() {
		PregnancyState.set(this.player, {
			progress: 0,
			current: 0,
			isInLabor: false
		});
		this.moodle?.moodle(0);
	}

	/**
	 * start Pregnancy (add Player trait)
	 */
	private start() {
		this.addTrait(ZLBFTraitsEnum.PREGNANCY);
		this.resetVariables();
		if (this.player) {
			ISTimedActionQueue.add(new ZLBFActionPregnancyStartAnimation(this.player));
		}
	}

	/**
	 * stop Pregnancy (remove Player trait)
	 */
	private stop() {
		this.removeTrait(ZLBFTraitsEnum.PREGNANCY);
		this.resetVariables();
	}

	/** Applies the incremental body effect associated with active labor. */
	private onLabor(delta: number) {
		void delta;
		this.applyBodyEffect(BodyPartType.Groin, { pain: 1, maxPain: 30 });
	}
	/**
	 * Called every in-game minute to advance pregnancy progress.
	 * - Updates pregnancy progress/time
	 * - Triggers labor and birth action when reaching full duration
	 */
	onEveryMinute(): void {
		if (!this.pregnancy) return;
		const duration = this.duration;
		const { current } = this.pregnancy;
		const previousInLabor = this.pregnancy.isInLabor ?? false;
		const updated = current + 1 > duration ? duration : current + 1;
		const isInLabor = updated == duration;
		PregnancyState.set(this.player, {
			current: updated,
			progress: updated / duration,
			isInLabor
		});
		if (isInLabor && !previousInLabor) {
			this.player!.setBlockMovement(true);
			ISTimedActionQueue.add(new ZLBFActionBirth(this));
		}
		this.moodle?.moodle(this.pregnancy.progress, true);
		triggerEvent(ZLBFEventsEnum.PREGNANCY_UPDATE, this.pregnancy);
	}

	/**
	 * Called every in-game hour to apply ongoing pregnancy effects.
	 * - Updates moodle
	 * - Adjusts thirst and calories consumption based on progress
	 */
	onEveryHour(): void {
		if (!this.pregnancy) return;

		const { progress } = this.pregnancy;
		this.moodle?.moodle(progress);

		if (progress < 0.25) return;

		// Consume extra water
		const stats = this.player!.getStats();
		const water = (0.5 * progress) / 1440;
		stats.set(CharacterStat.THIRST, Math.min(1, stats.get(CharacterStat.THIRST) + water));

		// Consume extra calories
		const nutrition = this.player!.getNutrition();
		const calories = (600 * progress) / 1440;
		nutrition.setCalories(Math.max(-2200, nutrition.getCalories() - calories));
	}

	/**
	 * Called every in-game day to apply less-frequent pregnancy effects.
	 * For example, apply food sickness early in pregnancy.
	 */
	onEveryDay() {
		if (!this.pregnancy) return;
		const { progress } = this.pregnancy;
		if (progress < 0.05 || progress > 0.33) return;
		this.player!.getBodyDamage().setFoodSicknessLevel(50 + ZombRand(0, 50));
	}

	/**
	 * Spawn the baby item, restore player movement and apply post-birth effects.
	 * Also stops the pregnancy state.
	 */
	public birth() {
		if (!this.player) return;
		this.player.getInventory().AddItem(ITEMS.BABY);
		this.player.setBlockMovement(false);
		this.applyStatEffect({
			stat: "FATIGUE",
			value: 0.75,
			maxValue: 0.75
		});
		this.stop();
	}
}
