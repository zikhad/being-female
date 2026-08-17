import { ISBaseTimedAction, triggerEvent } from "@asledgehammer/pipewrench";
import { AnimationUpdateConfig, ANIMATIONS } from "@client/components/Animation";
import { Pregnancy } from "@client/components/Pregnancy";
import { ZLBFAnimations, ZLBFEventsEnum } from "@constants";

export class ZLBFActionBirth extends ISBaseTimedAction {
	private pregnancy: Pregnancy;
	private readonly birthId?: string;

	/** Creates one client presentation for an optional server-issued birth operation. */
	constructor(pregnancy: Pregnancy, birthId?: string) {
		super(pregnancy.player);
		super.derive("ZLBFActionBirth");
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
		this.setActionAnim(ZLBFAnimations.BIRTH, null);
		triggerEvent(ZLBFEventsEnum.ANIMATION_START, ANIMATIONS.BIRTH);
	}

	update() {
		super.update();
		const delta = this.getJobDelta();
		triggerEvent(ZLBFEventsEnum.PREGNANCY_LABOR, delta);
		triggerEvent(ZLBFEventsEnum.ANIMATION_UPDATE, {
			delta,
			duration: this.maxTime
		} as AnimationUpdateConfig);
	}
	/** Cleans up a canceled presentation without completing its durable birth operation. */
	stop(): void {
		super.stop();
		triggerEvent(ZLBFEventsEnum.ANIMATION_STOP);
		this.pregnancy.onBirthPresentationStopped(this.birthId);
	}

	/** Completes the presentation and submits its server operation exactly once locally. */
	perform(): void {
		super.perform();
		this.pregnancy.birth(this.birthId);
		triggerEvent(ZLBFEventsEnum.ANIMATION_STOP);
	}
}
