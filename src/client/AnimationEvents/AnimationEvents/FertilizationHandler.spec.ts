/* eslint-disable @typescript-eslint/no-explicit-any */
import { onAnimationEvent } from "./FertilizationHandler";
import * as SpyPipewrench from "@asledgehammer/pipewrench";
import { MODS, BFEventsEnum } from "@constants";

jest.mock("@asledgehammer/pipewrench");

describe("FertilizationHandler", () => {
	const spyTriggerEvent = jest.spyOn(SpyPipewrench, "triggerEvent");
	const spyGetActivatedMods = jest.spyOn(SpyPipewrench, "getActivatedMods");

	const createMockModsList = (hasMod: boolean) => ({
		contains: jest.fn().mockReturnValue(hasMod)
	});

	beforeEach(() => {
		jest.clearAllMocks();
		(global as any).pairs = jest.fn(obj => Object.entries(obj));
	});

	const mockCharacter = (isFemale: boolean, isZombie: boolean) => ({
		isFemale: jest.fn().mockReturnValue(isFemale),
		isZombie: jest.fn().mockReturnValue(isZombie)
	});

	describe("early returns", () => {
		it("should return early when ZomboLust is not activated", () => {
			spyGetActivatedMods.mockReturnValue(createMockModsList(false) as any);
			onAnimationEvent({
				character: mockCharacter(true, false),
				stageConfig: { animName: "intercourse" }
			} as any);
			expect(spyTriggerEvent).not.toHaveBeenCalled();
		});

		it("should return early when ZomboDesire is not available", () => {
			spyGetActivatedMods.mockReturnValue(createMockModsList(true) as any);
			(global as any).ZomboDesire = undefined;
			onAnimationEvent({
				character: mockCharacter(true, false),
				stageConfig: { animName: "intercourse" }
			} as any);
			expect(spyTriggerEvent).not.toHaveBeenCalled();
		});

		it("should return early when ZomboDesire.AnimationConfigs is not available", () => {
			spyGetActivatedMods.mockReturnValue(createMockModsList(true) as any);
			(global as any).ZomboDesire = {};
			onAnimationEvent({
				character: mockCharacter(true, false),
				stageConfig: { animName: "intercourse" }
			} as any);
			expect(spyTriggerEvent).not.toHaveBeenCalled();
		});

		it("should return early when character is a zombie", () => {
			spyGetActivatedMods.mockReturnValue(createMockModsList(true) as any);
			(global as any).ZomboDesire = { AnimationConfigs: {} };
			onAnimationEvent({
				character: mockCharacter(true, true),
				stageConfig: { animName: "intercourse" }
			} as any);
			expect(spyTriggerEvent).not.toHaveBeenCalled();
		});

		it("should return early when character is not female", () => {
			spyGetActivatedMods.mockReturnValue(createMockModsList(true) as any);
			(global as any).ZomboDesire = { AnimationConfigs: {} };
			onAnimationEvent({
				character: mockCharacter(false, false),
				stageConfig: { animName: "intercourse" }
			} as any);
			expect(spyTriggerEvent).not.toHaveBeenCalled();
		});

		it("should return early when stageConfig is undefined", () => {
			spyGetActivatedMods.mockReturnValue(createMockModsList(true) as any);
			(global as any).ZomboDesire = { AnimationConfigs: {} };
			onAnimationEvent({ character: mockCharacter(true, false) } as any);
			expect(spyTriggerEvent).not.toHaveBeenCalled();
		});

		it("should return early when stageConfig.animName is undefined", () => {
			spyGetActivatedMods.mockReturnValue(createMockModsList(true) as any);
			(global as any).ZomboDesire = { AnimationConfigs: {} };
			onAnimationEvent({ character: mockCharacter(true, false), stageConfig: {} } as any);
			expect(spyTriggerEvent).not.toHaveBeenCalled();
		});

		it("should return early when animation config is not found", () => {
			spyGetActivatedMods.mockReturnValue(createMockModsList(true) as any);
			(global as any).ZomboDesire = { AnimationConfigs: {} };
			onAnimationEvent({
				character: mockCharacter(true, false),
				stageConfig: { animName: "unknown_animation" }
			} as any);
			expect(spyTriggerEvent).not.toHaveBeenCalled();
		});
	});

	describe("tag detection", () => {
		it("should trigger INTERCOURSE event when animation has Pregnancy tag in 'tags' field", () => {
			spyGetActivatedMods.mockReturnValue(createMockModsList(true) as any);
			(global as any).ZomboDesire = {
				AnimationConfigs: { intercourse: { tags: { Pregnancy: "true", Other: "value" } } }
			};
			onAnimationEvent({
				character: mockCharacter(true, false),
				stageConfig: { animName: "intercourse" }
			} as any);
			expect(spyTriggerEvent).toHaveBeenCalledWith(BFEventsEnum.INTERCOURSE);
		});

		it("should trigger INTERCOURSE event when animation has Pregnancy tag in 'Tags' field", () => {
			spyGetActivatedMods.mockReturnValue(createMockModsList(true) as any);
			(global as any).ZomboDesire = {
				AnimationConfigs: { intercourse: { Tags: { Pregnancy: "true", Other: "value" } } }
			};
			onAnimationEvent({
				character: mockCharacter(true, false),
				stageConfig: { animName: "intercourse" }
			} as any);
			expect(spyTriggerEvent).toHaveBeenCalledWith(BFEventsEnum.INTERCOURSE);
		});

		it("should detect Pregnancy tag as key in tags object", () => {
			spyGetActivatedMods.mockReturnValue(createMockModsList(true) as any);
			(global as any).ZomboDesire = {
				AnimationConfigs: {
					intercourse: { tags: { Pregnancy: "value", Other: "Pregnancy" } }
				}
			};
			onAnimationEvent({
				character: mockCharacter(true, false),
				stageConfig: { animName: "intercourse" }
			} as any);
			expect(spyTriggerEvent).toHaveBeenCalledWith(BFEventsEnum.INTERCOURSE);
		});

		it("should detect Pregnancy tag as value in tags object", () => {
			spyGetActivatedMods.mockReturnValue(createMockModsList(true) as any);
			(global as any).ZomboDesire = {
				AnimationConfigs: { intercourse: { tags: { Other: "Pregnancy" } } }
			};
			onAnimationEvent({
				character: mockCharacter(true, false),
				stageConfig: { animName: "intercourse" }
			} as any);
			expect(spyTriggerEvent).toHaveBeenCalledWith(BFEventsEnum.INTERCOURSE);
		});

		it("should not trigger event when animation has no Pregnancy tag", () => {
			spyGetActivatedMods.mockReturnValue(createMockModsList(true) as any);
			(global as any).ZomboDesire = {
				AnimationConfigs: { intercourse: { tags: { Other: "value", Another: "tag" } } }
			};
			onAnimationEvent({
				character: mockCharacter(true, false),
				stageConfig: { animName: "intercourse" }
			} as any);
			expect(spyTriggerEvent).not.toHaveBeenCalled();
		});

		it("should not trigger event when animation config has no tags", () => {
			spyGetActivatedMods.mockReturnValue(createMockModsList(true) as any);
			(global as any).ZomboDesire = { AnimationConfigs: { intercourse: {} } };
			onAnimationEvent({
				character: mockCharacter(true, false),
				stageConfig: { animName: "intercourse" }
			} as any);
			expect(spyTriggerEvent).not.toHaveBeenCalled();
		});

		it("should prefer 'tags' over 'Tags' when both are present", () => {
			spyGetActivatedMods.mockReturnValue(createMockModsList(true) as any);
			(global as any).ZomboDesire = {
				AnimationConfigs: {
					intercourse: { tags: { Pregnancy: "true" }, Tags: { Other: "value" } }
				}
			};
			onAnimationEvent({
				character: mockCharacter(true, false),
				stageConfig: { animName: "intercourse" }
			} as any);
			expect(spyTriggerEvent).toHaveBeenCalledWith(BFEventsEnum.INTERCOURSE);
		});
	});

	afterEach(() => {
		jest.clearAllMocks();
	});
});
