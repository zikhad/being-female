import { ISBaseTimedAction, triggerEvent } from "@asledgehammer/pipewrench";
import { AnimationUpdateConfig, ANIMATIONS } from "@client/components/Animation";
import { Pregnancy } from "@client/components/Pregnancy";
import { BFAnimations, BFEventsEnum } from "@constants";
import { emitBFNotification } from "@client/LegacyEventCompatibility";

export class BFActionBirth extends ISBaseTimedAction {
	private pregnancy: Pregnancy;
	private readonly birthId?: string;

	/** Creates one client presentation for an optional server-issued birth operation. */
	constructor(pregnancy: Pregnancy, birthId?: string) {
		super(pregnancy.player);
		super.derive("BFActionBirth");
		this.pregnancy = pregnancy;
		this.birthId = birthId;
		this.maxTime = 5500;
		this.stopOnWalk = false;
		this.stopOnRun = false;
		this.stopOnAim = false;
	}

	isValid() {
		return true;
	}

	start() {
		super.start();
		this.setActionAnim(BFAnimations.BIRTH, null);
		triggerEvent(BFEventsEnum.ANIMATION_START, ANIMATIONS.BIRTH);
	}

	update() {
		super.update();
		const delta = this.getJobDelta();
		emitBFNotification(BFEventsEnum.PREGNANCY_LABOR, delta);
		triggerEvent(BFEventsEnum.ANIMATION_UPDATE, {
			delta,
			duration: this.maxTime
		} as AnimationUpdateConfig);
	}
	/** Cleans up a canceled presentation without completing its durable birth operation. */
	stop(): void {
		super.stop();
		triggerEvent(BFEventsEnum.ANIMATION_STOP);
		this.pregnancy.onBirthPresentationStopped(this.birthId);
	}

	/** Completes the presentation and submits its server operation exactly once locally. */
	perform(): void {
		super.perform();
		this.pregnancy.birth(this.birthId);
		triggerEvent(BFEventsEnum.ANIMATION_STOP);
	}
}
