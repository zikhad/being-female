import { ISBaseTimedAction, IsoPlayer, triggerEvent } from "@asledgehammer/pipewrench";
import { ANIMATIONS, AnimationUpdateConfig } from "@client/components/Animation";
import { BFEventsEnum } from "@constants";

export class BFActionPregnancyStartAnimation extends ISBaseTimedAction {
	private readonly animation = ANIMATIONS.FERTILIZATION;
	// private variant = 0;
	constructor(player: IsoPlayer) {
		super(player);
		super.derive("BFActionPregnancyStartAnimation");
		this.maxTime = 800;
		this.stopOnWalk = false;
		this.stopOnRun = false;
		this.stopOnAim = false;
	}

	start() {
		super.start();
		triggerEvent(BFEventsEnum.ANIMATION_START, this.animation);
	}

	isValid() {
		return true;
	}

	update() {
		super.update();
		triggerEvent(BFEventsEnum.ANIMATION_UPDATE, {
			delta: this.getJobDelta(),
			duration: this.maxTime
		} as AnimationUpdateConfig);
	}

	stop() {
		super.stop();
		triggerEvent(BFEventsEnum.ANIMATION_STOP);
	}

	perform() {
		super.perform();
		triggerEvent(BFEventsEnum.ANIMATION_STOP);
	}
}
