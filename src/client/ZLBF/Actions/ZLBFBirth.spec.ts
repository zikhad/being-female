import { mock } from "jest-mock-extended";
import { ANIMATIONS } from "@client/components/Animation";
import { ZLBFActionBirth } from "@client/Actions/ZLBFBirth";
import { Pregnancy } from "@client/components/Pregnancy";
import { ISBaseTimedAction } from "@asledgehammer/pipewrench";
import * as SpyPipewrench from "@asledgehammer/pipewrench";
import { ZLBFEventsEnum } from "@constants";

jest.mock("@asledgehammer/pipewrench");

describe("ZLBFBirth", () => {
	let action: ZLBFActionBirth;
	const spyPregnancyBirth = jest.fn();
	const spyPresentationStopped = jest.fn();
	const spyTriggerEvent = jest.spyOn(SpyPipewrench, "triggerEvent");

	beforeEach(() => {
		jest.clearAllMocks();
		action = new ZLBFActionBirth(
			mock<Pregnancy>({
				birth: spyPregnancyBirth,
				onBirthPresentationStopped: spyPresentationStopped
			}),
			"mother:birth:1"
		);
	});

	it("isValid should be true", () => {
		expect(action.isValid()).toBe(true);
	});

	it("Start should set action anim", () => {
		const spy = jest.spyOn(ISBaseTimedAction.prototype, "setActionAnim");
		action.start();
		expect(spy).toHaveBeenCalled();
	});

	it("Start should trigger ANIMATION_START event with BIRTH animation", () => {
		action.start();
		expect(spyTriggerEvent).toHaveBeenCalledWith(
			ZLBFEventsEnum.ANIMATION_START,
			ANIMATIONS.BIRTH
		);
	});

	it("Update should trigger ANIMATION_UPDATE event", () => {
		action.update();
		expect(spyTriggerEvent).toHaveBeenCalled();
	});

	it("Stop should run base cleanup and defer the same birth operation", () => {
		const baseStop = jest.spyOn(ISBaseTimedAction.prototype, "stop");
		spyTriggerEvent.mockClear();
		action.stop();
		expect(baseStop).toHaveBeenCalled();
		expect(spyTriggerEvent).toHaveBeenCalledWith(ZLBFEventsEnum.ANIMATION_STOP);
		expect(spyPresentationStopped).toHaveBeenCalledWith("mother:birth:1");
		expect(spyPregnancyBirth).not.toHaveBeenCalled();
	});

	it("Perform should trigger ANIMATION_UPDATE & Pregnancy Birth", () => {
		action.perform();
		expect(spyTriggerEvent).toHaveBeenCalled();
		expect(spyPregnancyBirth).toHaveBeenCalledWith("mother:birth:1");
		expect(spyPresentationStopped).not.toHaveBeenCalled();
	});
});
