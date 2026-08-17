import type { PregnancyData } from "@types";
import {
	BodyPartType,
	getGameTime,
	IsoPlayer,
	triggerEvent,
	ZombRand
} from "@asledgehammer/pipewrench";
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
import { BirthPublisher } from "@client/components/network/BirthPublisher";

/** Mutually exclusive client presentation state for one local birth animation lifecycle. */
type BirthPresentationState =
	| { phase: "idle"; birthId?: undefined }
	| { phase: "active"; birthId?: string }
	| { phase: "interrupted"; birthId?: string }
	| { phase: "submitted"; birthId: string };

export class Pregnancy extends Player<PregnancyData> implements TimedEvents {
	private moodle?: Moodle;
	private lastMinuteStamp?: number;
	private lastAppliedStatus?: PregnancyStatus;
	/** Current local birth presentation phase; durable authoritative state remains in snapshots. */
	private birthPresentation: BirthPresentationState = { phase: "idle" };

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
		private readonly snapshots?: SnapshotStore,
		private readonly births?: BirthPublisher
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
		const pregnancy = this.commands?.latestDesiredState ?? snapshot.domains.pregnancy;
		const previousStatus = this.lastAppliedStatus;
		this.lastAppliedStatus = pregnancy.status;
		if (pregnancy.status === PregnancyStatus.NOT_PREGNANT) {
			this.player?.setBlockMovement(false);
			this.birthPresentation = { phase: "idle" };
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
		if (previousStatus === PregnancyStatus.NOT_PREGNANT) this.playStartAnimation();
		if (pregnancy.isInLabor && !snapshot.domains.birth.pendingBirthId) {
			this.births?.allocate();
		}
		this.queuePendingBirthPresentation(snapshot, false);
	}

	/**
	 * Queues the authoritative pending birth when it has no active or submitted presentation.
	 *
	 * @param snapshot Latest authoritative snapshot containing the durable operation identity.
	 * @param canResumeInterrupted Whether the minute lifecycle may resume a canceled presentation.
	 */
	private queuePendingBirthPresentation(
		snapshot: ZLBFSnapshot,
		canResumeInterrupted: boolean
	): void {
		const pendingBirthId = snapshot.domains.birth.pendingBirthId;
		if (!snapshot.domains.pregnancy.isInLabor || !pendingBirthId) return;
		const presentation = this.birthPresentation;
		if (presentation.phase === "active") return;
		if (presentation.phase === "submitted" && presentation.birthId === pendingBirthId)
			return;
		if (
			presentation.phase === "interrupted" &&
			presentation.birthId === pendingBirthId &&
			!canResumeInterrupted
		)
			return;

		this.birthPresentation = { phase: "active", birthId: pendingBirthId };
		this.player?.setBlockMovement(true);
		ISTimedActionQueue.add(new ZLBFActionBirth(this, pendingBirthId));
	}

	/**
	 * Queues or resumes the legacy local birth presentation without a server operation ID.
	 *
	 * @param canResumeInterrupted Whether the minute lifecycle may resume a canceled action.
	 * @param isInLabor Current local labor state, including a transition calculated this minute.
	 */
	private queueLegacyBirthPresentation(
		canResumeInterrupted: boolean,
		isInLabor: boolean
	): void {
		if (this.births) return;
		if (!isInLabor) return;
		const presentation = this.birthPresentation;
		if (presentation.phase === "active" || presentation.phase === "submitted") return;
		if (presentation.phase === "interrupted" && !canResumeInterrupted) return;

		this.birthPresentation = { phase: "active" };
		this.player?.setBlockMovement(true);
		ISTimedActionQueue.add(new ZLBFActionBirth(this));
	}

	protected onCreatePlayer(player: IsoPlayer): void {
		super.onCreatePlayer(player);
		this.lastMinuteStamp = getGameTime().getMinutesStamp();
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

	/** Publishes a normal conception result or applies the legacy local fallback. */
	private start() {
		if (this.commands) {
			const desired = this.commands.latestDesiredState ?? this.authoritativePregnancy;
			if (desired.status === PregnancyStatus.PREGNANT) return;
			this.commands.publishState({
				...createDefaultPregnancyState(),
				status: PregnancyStatus.PREGNANT
			});
			return;
		}
		this.addTrait(ZLBFTraitsEnum.PREGNANCY);
		this.resetVariables();
		this.playStartAnimation();
	}

	/** Queues the client-only Pregnancy start presentation for the bound player. */
	private playStartAnimation(): void {
		if (this.player) ISTimedActionQueue.add(new ZLBFActionPregnancyStartAnimation(this.player));
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
		const minuteStamp = getGameTime().getMinutesStamp();
		const elapsed = Math.max(0, minuteStamp - (this.lastMinuteStamp ?? minuteStamp - 1));
		this.lastMinuteStamp = minuteStamp;
		const pregnancy = this.pregnancy;
		if (!pregnancy) return;
		if (this.commands && !this.snapshots?.snapshot) return;
		const snapshot = this.snapshots?.snapshot;
		if (snapshot) this.queuePendingBirthPresentation(snapshot, true);
		else if (this.birthPresentation.phase === "interrupted")
			this.queueLegacyBirthPresentation(true, pregnancy.isInLabor ?? false);
		if (elapsed === 0) return;
		const duration = this.duration;
		const { current } = pregnancy;
		const previousInLabor = pregnancy.isInLabor ?? false;
		if (current >= duration && previousInLabor) return;
		const updated = Math.min(duration, current + elapsed);
		const isInLabor = updated == duration;
		PregnancyState.set(this.player, {
			current: updated,
			progress: updated / duration,
			isInLabor
		});
		this.commands?.publishState({
			status: PregnancyStatus.PREGNANT,
			current: updated,
			progress: updated / duration,
			isInLabor
		});
		if (isInLabor && !previousInLabor && !this.births) {
			this.queueLegacyBirthPresentation(false, true);
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
	 * Submits an authoritative birth completion or performs the legacy local fallback.
	 *
	 * @param birthId Server-issued identity carried by the completed presentation action.
	 */
	public birth(birthId?: string): void {
		if (!this.player) return;
		const pendingBirthId = this.snapshots?.snapshot?.domains.birth.pendingBirthId;
		if (this.births) {
			if (!birthId || birthId !== pendingBirthId) return;
			const presentation = this.birthPresentation;
			if (presentation.phase !== "active" || presentation.birthId !== birthId)
				return;
			this.birthPresentation = { phase: "submitted", birthId };
			this.player.setBlockMovement(false);
			this.births.complete(birthId);
			return;
		}
		this.birthPresentation = { phase: "idle" };
		this.player.getInventory().AddItem(ITEMS.BABY);
		this.player.setBlockMovement(false);
		this.applyStatEffect({
			stat: "FATIGUE",
			value: 0.75,
			maxValue: 0.75
		});
		this.stop();
	}

	/**
	 * Releases canceled birth presentation state while retaining its authoritative operation.
	 * The next minute lifecycle may queue the same birth ID after menu and action cleanup settle.
	 *
	 * @param birthId Server-issued identity carried by the canceled action, when authoritative.
	 */
	public onBirthPresentationStopped(birthId?: string): void {
		const presentation = this.birthPresentation;
		if (presentation.phase !== "active" || presentation.birthId !== birthId) return;
		this.birthPresentation = { phase: "interrupted", birthId };
		this.player?.setBlockMovement(false);
	}
}
