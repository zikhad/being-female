import type { PregnancyData } from "@types";
import { BodyPartType, getGameTime, IsoPlayer, ZombRand } from "@asledgehammer/pipewrench";
import * as Events from "@asledgehammer/pipewrench-events";
import { ISTimedActionQueue } from "@asledgehammer/pipewrench/client";
import { ITEMS, BFEventsEnum, BFTraitsEnum } from "@constants";
import { emitBFNotification } from "@client/LegacyEventCompatibility";
import { BFActionBirth } from "@actions/BFBirth";
import { BFActionPregnancyStartAnimation } from "@actions/BFPregnancyStartAnimation";
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
import type { BFSnapshot } from "@shared/BFProtocol";
import { BirthPublisher } from "@client/components/network/BirthPublisher";

/** Mutually exclusive client presentation state for one local birth animation lifecycle. */
type BirthPresentationState =
	| { phase: "idle"; birthId?: undefined }
	| { phase: "active"; birthId?: string }
	| { phase: "interrupted"; birthId?: string }
	| { phase: "submitted"; birthId: string };

/** Lifecycle identity of the local character currently owned by this retained component. */
type CharacterBindingState =
	| { phase: "unbound"; player?: undefined }
	| { phase: "active"; player: IsoPlayer }
	| { phase: "dead"; player: IsoPlayer };

/** Coordinates local Pregnancy simulation and birth presentation for the currently bound player. */
export class Pregnancy extends Player<PregnancyData> implements TimedEvents {
	private moodle?: Moodle;
	private lastMinuteStamp?: number;
	private lastAppliedStatus?: PregnancyStatus;
	/** Current character lifecycle binding, independent from birth presentation state. */
	private characterBinding: CharacterBindingState = { phase: "unbound" };
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
			if (!this.isActiveBinding()) return;
			if (this.commands) {
				this.commands.setState({
					...createDefaultPregnancyState(),
					status: PregnancyStatus.PREGNANT
				});
				return;
			}
			this.start();
		},
		stop: () => {
			if (!this.isActiveBinding()) return;
			if (this.commands) {
				this.commands.setState(createDefaultPregnancyState());
				return;
			}
			this.stop();
		},
		advance: (minutes: number) => {
			if (!this.isActiveBinding()) return;
			const pregnancy = this.authoritativePregnancy;
			if (pregnancy.status !== PregnancyStatus.PREGNANT) return;

			const { current } = pregnancy;
			const duration = this.duration;
			const updated = Math.min(duration, current + minutes);
			const next = {
				status: PregnancyStatus.PREGNANT,
				current: updated,
				progress: updated / duration,
				isInLabor: updated == duration
			};
			if (this.commands) {
				this.commands.setState(next);
				return;
			}
			this.applyLocalPregnancyState(next);
		},
		advanceToLabor: () => {
			if (!this.isActiveBinding()) return;
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
		this.installListeners();
	}

	/** Returns whether the retained component currently owns one living bound player object. */
	private isActiveBinding(): boolean {
		return (
			this.characterBinding.phase === "active" && this.characterBinding.player === this.player
		);
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

	/**
	 * Applies acknowledged authoritative Pregnancy state to legacy client presentation state.
	 * Snapshots received after the bound character dies are retained by networking but ignored here.
	 */
	private applyAuthoritativeSnapshot(snapshot: BFSnapshot): void {
		if (!this.isActiveBinding()) return;
		const pregnancy = this.commands?.latestDesiredState ?? snapshot.domains.pregnancy;
		const previousStatus = this.lastAppliedStatus;
		this.lastAppliedStatus = pregnancy.status;
		if (pregnancy.status === PregnancyStatus.NOT_PREGNANT) {
			this.player?.setBlockMovement(false);
			this.birthPresentation = { phase: "idle" };
			this.removeTrait(BFTraitsEnum.PREGNANCY);
			this.resetVariables();
			return;
		}

		this.addTrait(BFTraitsEnum.PREGNANCY);
		const presentation: PregnancyData = {
			current: pregnancy.current,
			progress: pregnancy.progress,
			isInLabor: pregnancy.isInLabor
		};
		PregnancyState.set(this.player, presentation);
		this.moodle?.moodle(pregnancy.progress);
		emitBFNotification(BFEventsEnum.PREGNANCY_UPDATE, presentation);
		if (previousStatus === PregnancyStatus.NOT_PREGNANT) this.playStartAnimation();
		if (pregnancy.isInLabor && !snapshot.domains.birth.pendingBirthId) {
			this.births?.allocate();
		}
		const pendingBirthId = snapshot.domains.birth.pendingBirthId;
		if (
			pendingBirthId &&
			this.birthPresentation.phase === "submitted" &&
			this.birthPresentation.birthId === pendingBirthId
		) {
			this.births?.complete(pendingBirthId);
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
		snapshot: BFSnapshot,
		canResumeInterrupted: boolean
	): void {
		if (!this.isActiveBinding()) return;
		const pendingBirthId = snapshot.domains.birth.pendingBirthId;
		if (!snapshot.domains.pregnancy.isInLabor || !pendingBirthId) return;
		const presentation = this.birthPresentation;
		if (presentation.phase === "active") return;
		if (presentation.phase === "submitted" && presentation.birthId === pendingBirthId) return;
		if (
			presentation.phase === "interrupted" &&
			presentation.birthId === pendingBirthId &&
			!canResumeInterrupted
		)
			return;

		this.birthPresentation = { phase: "active", birthId: pendingBirthId };
		this.player?.setBlockMovement(true);
		ISTimedActionQueue.add(new BFActionBirth(this, pendingBirthId));
	}

	/**
	 * Queues or resumes the legacy local birth presentation without a server operation ID.
	 *
	 * @param canResumeInterrupted Whether the minute lifecycle may resume a canceled action.
	 * @param isInLabor Current local labor state, including a transition calculated this minute.
	 */
	private queueLegacyBirthPresentation(canResumeInterrupted: boolean, isInLabor: boolean): void {
		if (!this.isActiveBinding()) return;
		if (this.births) return;
		if (!isInLabor) return;
		const presentation = this.birthPresentation;
		if (presentation.phase === "active" || presentation.phase === "submitted") return;
		if (presentation.phase === "interrupted" && !canResumeInterrupted) return;

		this.birthPresentation = { phase: "active" };
		this.player?.setBlockMovement(true);
		ISTimedActionQueue.add(new BFActionBirth(this));
	}

	/**
	 * Binds a newly created local character to the component's retained lifecycle listeners.
	 * A prior dead character's retained snapshot is discarded before the replacement can render it.
	 *
	 * @param player Newly created local player object supplied by `OnCreatePlayer`.
	 */
	protected onCreatePlayer(player: IsoPlayer): void {
		if (this.characterBinding.phase === "dead") this.snapshots?.resetSession();
		this.characterBinding = { phase: "active", player };
		this.birthPresentation = { phase: "idle" };
		this.lastAppliedStatus = undefined;
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
	}

	/** Installs singleton lifecycle callbacks once at this component's construction boundary. */
	private installListeners(): void {
		Events.everyOneMinute.addListener(() => this.onEveryMinute());
		Events.everyHours.addListener(() => this.onEveryHour());
		Events.everyDays.addListener(() => this.onEveryDay());
		Events.onPlayerDeath.addListener(deadPlayer => this.onPlayerDeath(deadPlayer));
		new Events.EventEmitter(BFEventsEnum.PREGNANCY_START).addListener(() => this.start());
		new Events.EventEmitter(BFEventsEnum.PREGNANCY_STOP).addListener(() => this.stop());
		new Events.EventEmitter<(delta: number) => void>(BFEventsEnum.PREGNANCY_LABOR).addListener(
			delta => this.onLabor(delta)
		);
	}

	/**
	 * Terminates presentation only when the death event belongs to the exact currently bound player.
	 * Pending Pregnancy and birth requests are cleared locally so shared minute publishers cannot
	 * retry an operation for the dead object.
	 *
	 * @param deadPlayer Player object supplied by Build 42's `OnPlayerDeath` event.
	 */
	private onPlayerDeath(deadPlayer: IsoPlayer): void {
		if (!this.isActiveBinding() || deadPlayer !== this.characterBinding.player) return;
		deadPlayer.setBlockMovement(false);
		this.characterBinding = { phase: "dead", player: deadPlayer };
		this.birthPresentation = { phase: "idle" };
		this.commands?.resetSession();
		this.births?.resetSession();
		this.snapshots?.resetSession();
	}

	/** Returns Pregnancy presentation data using authoritative status when synchronized. */
	public get pregnancy(): PregnancyData | null {
		if (!this.isActiveBinding()) return null;
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
	 * Applies one complete single-player Pregnancy state and emits its local presentation effects.
	 *
	 * @param state Complete Pregnancy value produced by a local debug or simulation transition.
	 */
	private applyLocalPregnancyState(state: AuthoritativePregnancyState): void {
		const previousInLabor = this.pregnancy?.isInLabor ?? false;
		PregnancyState.set(this.player, {
			current: state.current,
			progress: state.progress,
			isInLabor: state.isInLabor
		});
		this.moodle?.moodle(state.progress, true);
		emitBFNotification(BFEventsEnum.PREGNANCY_UPDATE, this.pregnancy);
		if (state.isInLabor && !previousInLabor) {
			this.queueLegacyBirthPresentation(false, true);
		}
	}

	/** Publishes a normal conception result or applies the legacy local fallback. */
	private start() {
		if (!this.isActiveBinding()) return;
		if (this.commands) {
			const desired = this.commands.latestDesiredState ?? this.authoritativePregnancy;
			if (desired.status === PregnancyStatus.PREGNANT) return;
			this.commands.publishState({
				...createDefaultPregnancyState(),
				status: PregnancyStatus.PREGNANT
			});
			return;
		}
		this.addTrait(BFTraitsEnum.PREGNANCY);
		this.resetVariables();
		this.playStartAnimation();
	}

	/** Queues the client-only Pregnancy start presentation for the bound player. */
	private playStartAnimation(): void {
		if (this.player) ISTimedActionQueue.add(new BFActionPregnancyStartAnimation(this.player));
	}

	/**
	 * stop Pregnancy (remove Player trait)
	 */
	private stop() {
		if (!this.isActiveBinding()) return;
		this.removeTrait(BFTraitsEnum.PREGNANCY);
		this.resetVariables();
	}

	/** Applies the incremental body effect associated with active labor. */
	private onLabor(delta: number) {
		if (!this.isActiveBinding()) return;
		void delta;
		this.applyBodyEffect(BodyPartType.Groin, { pain: 1, maxPain: 30 });
	}
	/**
	 * Called every in-game minute to advance pregnancy progress.
	 * - Updates pregnancy progress/time
	 * - Triggers labor and birth action when reaching full duration
	 * Dead bound characters are terminal and cannot publish, allocate, queue, or resubmit birth work.
	 */
	onEveryMinute(): void {
		if (!this.isActiveBinding()) return;
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
		emitBFNotification(BFEventsEnum.PREGNANCY_UPDATE, this.pregnancy);
	}

	/**
	 * Called every in-game hour to apply ongoing pregnancy effects.
	 * - Updates moodle
	 * - Adjusts thirst and calories consumption based on progress
	 */
	onEveryHour(): void {
		if (!this.isActiveBinding()) return;
		if (!this.pregnancy) return;

		const { progress } = this.pregnancy;
		this.moodle?.moodle(progress);

		if (progress < 0.25) return;

		// Consume extra water
		const water = (0.5 * progress) / 1440;
		this.applyStatEffect({ stat: "THIRST", value: water, maxValue: 1 });

		// Consume extra calories
		const nutrition = this.player!.getNutrition();
		const calories = (600 * progress) / 1440;
		nutrition.setCalories(Math.max(-2200, nutrition.getCalories() - calories));
	}

	/**
	 * Called every in-game day to apply less-frequent pregnancy effects.
	 * Adds early-pregnancy food sickness to any existing sickness and relies on
	 * the CharacterStat bounds to clamp the combined value at 100.
	 */
	onEveryDay(): void {
		if (!this.isActiveBinding()) return;
		if (!this.pregnancy) return;
		const { progress } = this.pregnancy;
		if (progress < 0.05 || progress > 0.33) return;
		this.applyStatEffect({ stat: "FOOD_SICKNESS", value: 50 + ZombRand(0, 50) });
	}

	/**
	 * Submits an authoritative birth completion or performs the legacy local fallback.
	 * Completion callbacks arriving after the bound character dies are ignored.
	 *
	 * @param birthId Server-issued identity carried by the completed presentation action.
	 */
	public birth(birthId?: string): void {
		if (!this.isActiveBinding() || !this.player) return;
		const pendingBirthId = this.snapshots?.snapshot?.domains.birth.pendingBirthId;
		if (this.births) {
			if (!birthId || birthId !== pendingBirthId) return;
			const presentation = this.birthPresentation;
			if (presentation.phase !== "active" || presentation.birthId !== birthId) return;
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
	 * Stop callbacks arriving after death cannot make the presentation resumable again.
	 *
	 * @param birthId Server-issued identity carried by the canceled action, when authoritative.
	 */
	public onBirthPresentationStopped(birthId?: string): void {
		if (!this.isActiveBinding()) return;
		const presentation = this.birthPresentation;
		if (presentation.phase !== "active" || presentation.birthId !== birthId) return;
		this.birthPresentation = { phase: "interrupted", birthId };
		this.player?.setBlockMovement(false);
	}
}
