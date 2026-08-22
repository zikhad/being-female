/* eslint-disable @typescript-eslint/no-explicit-any */
import * as Events from "@asledgehammer/pipewrench-events";
import * as SpyPipewrench from "@asledgehammer/pipewrench";
import { Animation, ANIMATIONS, AnimationUpdateConfig } from "@client/components/Animation";
import { Womb } from "@client/components/Womb";
import { ITEMS, BFEventsEnum } from "@constants";
import { mock } from "jest-mock-extended";
import { PregnancyData } from "@types";

jest.mock("@asledgehammer/pipewrench-events");
jest.mock("@asledgehammer/pipewrench");
jest.mock("@client/components/Womb");

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal Womb stub for Animation tests. */
const makeWomb = (
	overrides: Partial<Womb> = {},
	options: Partial<{ hasCondom: boolean }> = {}
): Womb => {
	const { hasCondom = false } = options;
	return mock<Womb>({
		...overrides,
		hasItem: jest.fn().mockImplementation((item: string) => item === ITEMS.CONDOM && hasCondom)
	});
};

/** Default animation payload for intercourse at the very start of a cycle. */
const updateAnimation = (
	overrides: Partial<AnimationUpdateConfig> = {}
): AnimationUpdateConfig => ({
	duration: 1000,
	delta: 0,
	...overrides
});

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe("Animation", () => {
	let mockAddListener: jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();
		jest.resetAllMocks();

		mockAddListener = jest.fn();
		jest.spyOn(Events, "EventEmitter").mockReturnValue({ addListener: mockAddListener } as any);

		// Reset static state between runs
		Animation.wombImage = "media/ui/womb/normal/womb_normal_0.png";
		Animation.animation = undefined;
		(Animation as any).isAnimationActive = false;
	});

	// ─── Constructor ───────────────────────────────────────────────────────

	describe("Constructor", () => {
		it("should register listeners for ANIMATION, ANIMATION_START, ANIMATION_STOP, and IMAGE events", () => {
			const womb = makeWomb();
			new Animation(womb);

			const calledEvents = (Events.EventEmitter as jest.Mock).mock.calls.map(
				([event]: [string]) => event
			);
			expect(calledEvents).toContain(BFEventsEnum.ANIMATION_UPDATE);
			expect(calledEvents).toContain(BFEventsEnum.ANIMATION_START);
			expect(calledEvents).toContain(BFEventsEnum.ANIMATION_STOP);
			expect(calledEvents).toContain(BFEventsEnum.IMAGE);
			expect(mockAddListener).toHaveBeenCalledTimes(4);
		});
	});

	// ─── onAnimation ───────────────────────────────────────────────────────

	beforeAll(() => {
		// (SpyPipewrench as any).ZombRandBetween = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
		(SpyPipewrench as any).ZombRandBetween = (min: number) => min;
	});

	describe("onAnimation", () => {
		describe("normal animation (no condom, no pregnancy)", () => {
			it("should set the wombImage to the correct empty-fullness frame at delta 0", () => {
				const womb = makeWomb({ amount: 0, capacity: 1 });
				const animationInstance = new Animation(womb);

				animationInstance.onAnimationStart(ANIMATIONS.INTERCOURSE);
				animationInstance.onAnimation(updateAnimation({ delta: 0, duration: 1000 }));

				expect(Animation.wombImage).toBe("media/ui/animation/intercourse/empty/0.png");
			});

			it("should set the wombImage to full-fullness when amount exceeds half capacity", () => {
				const womb = makeWomb({ amount: 0.6, capacity: 1 });
				const animationInstance = new Animation(womb);

				animationInstance.onAnimationStart(ANIMATIONS.INTERCOURSE);
				animationInstance.onAnimation(updateAnimation({ delta: 0, duration: 1000 }));

				expect(Animation.wombImage).toBe("media/ui/animation/intercourse/full/0.png");
			});

			it("should advance to the next frame when delta increases", () => {
				const womb = makeWomb({ amount: 0, capacity: 1 });
				const animationInstance = new Animation(womb);

				// Normal animation loops the bounce sequence 20 times before ending.
				const normalSteps = [
					...Array.from({ length: 20 }, () => [0, 1, 2, 3, 4, 3, 2, 1]).flat(),
					...([0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as number[])
				];
				const duration = 1000;
				const stepDuration = duration / normalSteps.length;

				// Pick a delta mid-step to land on step index 1
				const delta = (stepDuration * 1.5) / duration;
				animationInstance.onAnimationStart(ANIMATIONS.INTERCOURSE);
				animationInstance.onAnimation(updateAnimation({ delta, duration }));

				expect(Animation.wombImage).toBe(
					`media/ui/animation/intercourse/empty/${normalSteps[1]}.png`
				);
			});
		});

		describe("condom animation", () => {
			it("should use the condom path when player has a condom", () => {
				const womb = makeWomb({ amount: 0, capacity: 1 }, { hasCondom: true });
				const animationInstance = new Animation(womb);

				animationInstance.onAnimationStart(ANIMATIONS.INTERCOURSE);
				animationInstance.onAnimation(updateAnimation());

				expect(Animation.wombImage).toMatch(/^media\/ui\/animation\/condom\/\d+\.png$/);
			});
		});

		describe("fertilization animation with variants", () => {
			it("fertilization animation variant", () => {
				const womb = makeWomb();
				const animationInstance = new Animation(womb);

				animationInstance.onAnimationStart(ANIMATIONS.FERTILIZATION);

				animationInstance.onAnimation({
					delta: 0,
					duration: 1000
				});

				expect(Animation.wombImage).toMatch(/fertilization/);
				expect(Animation.wombImage).not.toMatch(/-v/);

				const wombPregnant = makeWomb({ pregnancy: { progress: 0.6 } as PregnancyData });
				const animationPregnant = new Animation(wombPregnant);

				animationPregnant.onAnimationStart(ANIMATIONS.FERTILIZATION);
				animationPregnant.onAnimation(updateAnimation());
				expect(Animation.wombImage).toBe("media/ui/animation/fertilization/0.png");
			});
		});
	});

	describe("onAnimationStart", () => {
		it("should set animation directly when passed a concrete animation setting", () => {
			const womb = makeWomb();
			const animationInstance = new Animation(womb);

			animationInstance.onAnimationStart({
				name: "manual",
				steps: [0, 2, 4],
				loop: 1,
				path: "media/custom"
			});

			expect(Animation.animation).toMatchObject({
				name: "manual",
				steps: [0, 2, 4],
				path: "media/custom"
			});
		});

		it("should leave animation undefined when no variant matches current flags", () => {
			const womb = makeWomb(
				{ pregnancy: { progress: 0.6 } as PregnancyData },
				{ hasCondom: true }
			);
			const animationInstance = new Animation(womb);

			animationInstance.onAnimationStart(ANIMATIONS.INTERCOURSE);

			expect(Animation.animation).toBeUndefined();
		});

		it("should leave animation undefined when the animation has no configured variants", () => {
			const womb = makeWomb();
			const animationInstance = new Animation(womb);
			const backup = Animation.defaultAnimations[ANIMATIONS.BIRTH];

			try {
				(Animation.defaultAnimations as any)[ANIMATIONS.BIRTH] = [];
				animationInstance.onAnimationStart(ANIMATIONS.BIRTH);
				expect(Animation.animation).toBeUndefined();
			} finally {
				(Animation.defaultAnimations as any)[ANIMATIONS.BIRTH] = backup;
			}
		});
	});

	describe("onAnimation guards", () => {
		it("should keep current image when no active animation exists", () => {
			const womb = makeWomb();
			const animationInstance = new Animation(womb);

			animationInstance.onAnimation(updateAnimation({ delta: 0.5 }));

			expect(Animation.wombImage).toBe("media/ui/womb/normal/womb_normal_0.png");
		});

		it("should omit fullness segment when animation does not support fullness", () => {
			const womb = makeWomb({ amount: 0.8, capacity: 1 });
			const animationInstance = new Animation(womb);

			animationInstance.onAnimationStart({
				name: "custom-no-fullness",
				steps: [0, 1],
				path: "media/custom/no-fullness"
			});
			animationInstance.onAnimation(updateAnimation());

			expect(Animation.wombImage).toBe("media/custom/no-fullness/custom-no-fullness/0.png");
		});
	});

	// ─── onAnimationStop ───────────────────────────────────────────────────

	describe("preloadFrames", () => {
		let getTextureMock: jest.Mock;

		beforeEach(() => {
			getTextureMock = jest.fn();
			(SpyPipewrench as any).getTexture = getTextureMock;
		});

		it("should call pcall+getTexture for every step when animation has no fullnessSupport", () => {
			const womb = makeWomb();
			const animationInstance = new Animation(womb);

			animationInstance.onAnimationStart(ANIMATIONS.BIRTH);

			// birth variant: steps = createArray(12) → [0..11], no fullnessSupport
			const BIRTH_ANIMATION = Animation.defaultAnimations[ANIMATIONS.BIRTH][0];
			expect(getTextureMock).toHaveBeenCalledTimes(BIRTH_ANIMATION.steps.length);
			for (const step of BIRTH_ANIMATION.steps) {
				expect(getTextureMock).toHaveBeenCalledWith(`media/ui/animation/birth/${step}.png`);
			}
		});

		it("should call pcall+getTexture for every step across all fullness variants", () => {
			const womb = makeWomb({ amount: 0, capacity: 1 });
			const animationInstance = new Animation(womb);

			// intercourse: fullnessSupport: ["empty", "full"], steps has 170 entries
			animationInstance.onAnimationStart(ANIMATIONS.INTERCOURSE);

			const intercourseSteps = Animation.animation!.steps;
			const expectedCalls = intercourseSteps.length * 2; // empty + full
			expect(getTextureMock).toHaveBeenCalledTimes(expectedCalls);

			for (const step of intercourseSteps) {
				expect(getTextureMock).toHaveBeenCalledWith(
					`media/ui/animation/intercourse/empty/${step}.png`
				);
				expect(getTextureMock).toHaveBeenCalledWith(
					`media/ui/animation/intercourse/full/${step}.png`
				);
			}
		});

		it("should not call getTexture when no animation variant is selected", () => {
			const womb = makeWomb(
				{ pregnancy: { progress: 0.6 } as PregnancyData },
				{ hasCondom: true }
			);
			const animationInstance = new Animation(womb);

			animationInstance.onAnimationStart(ANIMATIONS.INTERCOURSE);

			expect(Animation.animation).toBeUndefined();
			expect(getTextureMock).not.toHaveBeenCalled();
		});

		it("should preload frames when a concrete AnimationSetting is passed directly", () => {
			const womb = makeWomb();
			const animationInstance = new Animation(womb);

			animationInstance.onAnimationStart({
				name: "custom",
				steps: [0, 1, 2],
				path: "media/custom-path"
			});

			expect(getTextureMock).toHaveBeenCalledTimes(3);
			expect(getTextureMock).toHaveBeenCalledWith("media/custom-path/custom/0.png");
			expect(getTextureMock).toHaveBeenCalledWith("media/custom-path/custom/1.png");
			expect(getTextureMock).toHaveBeenCalledWith("media/custom-path/custom/2.png");
		});
	});

	describe("onAnimationStop", () => {
		it("should mark animation as inactive", () => {
			const womb = makeWomb();
			const animationInstance = new Animation(womb);

			animationInstance.onAnimationStart(ANIMATIONS.INTERCOURSE);
			expect(Animation.animation).not.toBeUndefined();
			animationInstance.onAnimationStop();
			expect(Animation.animation).toBeUndefined();
		});
	});

	// ─── Event wiring ──────────────────────────────────────────────────────

	describe("Event wiring via EventEmitter", () => {
		it("ANIMATION_START event should invoke onAnimationStart", () => {
			const womb = makeWomb();
			const animationInstance = new Animation(womb);

			const startCallIdx = (Events.EventEmitter as jest.Mock).mock.calls.findIndex(
				([event]: [string]) => event === BFEventsEnum.ANIMATION_START
			);
			const [onStartListener] = mockAddListener.mock.calls[startCallIdx];

			const spy = jest.spyOn(animationInstance, "onAnimationStart");
			onStartListener(ANIMATIONS.INTERCOURSE);
			expect(spy).toHaveBeenCalled();
		});

		it("ANIMATION_START event should forward animation payload", () => {
			const womb = makeWomb();
			const animationInstance = new Animation(womb);

			const startCallIdx = (Events.EventEmitter as jest.Mock).mock.calls.findIndex(
				([event]: [string]) => event === BFEventsEnum.ANIMATION_START
			);
			const [onStartListener] = mockAddListener.mock.calls[startCallIdx];

			const spy = jest.spyOn(animationInstance, "onAnimationStart");
			onStartListener(ANIMATIONS.BIRTH);
			expect(spy).toHaveBeenCalledWith(ANIMATIONS.BIRTH);
		});

		it("ANIMATION event should invoke onAnimation", () => {
			const womb = makeWomb();
			const animationInstance = new Animation(womb);

			// Find the listener registered for ANIMATION
			const animationCallIdx = (Events.EventEmitter as jest.Mock).mock.calls.findIndex(
				([event]: [string]) => event === BFEventsEnum.ANIMATION_UPDATE
			);
			const [onAnimationListener] = mockAddListener.mock.calls[animationCallIdx];

			const spy = jest.spyOn(animationInstance, "onAnimation");
			onAnimationListener(updateAnimation({ delta: 0.5, duration: 1000 }));
			expect(spy).toHaveBeenCalled();
		});

		it("ANIMATION_STOP event should invoke onAnimationStop", () => {
			const womb = makeWomb();
			const animationInstance = new Animation(womb);

			const stopCallIdx = (Events.EventEmitter as jest.Mock).mock.calls.findIndex(
				([event]: [string]) => event === BFEventsEnum.ANIMATION_STOP
			);
			const [onStopListener] = mockAddListener.mock.calls[stopCallIdx];

			const spy = jest.spyOn(animationInstance, "onAnimationStop");
			onStopListener();
			expect(spy).toHaveBeenCalled();
		});

		it("IMAGE event should invoke onImage", () => {
			const womb = makeWomb();
			const animationInstance = new Animation(womb);

			const imageCallIdx = (Events.EventEmitter as jest.Mock).mock.calls.findIndex(
				([event]: [string]) => event === BFEventsEnum.IMAGE
			);
			const [onImageListener] = mockAddListener.mock.calls[imageCallIdx];

			const spy = jest.spyOn(animationInstance, "onImage");
			onImageListener();
			expect(spy).toHaveBeenCalled();
		});
	});

	describe("onImage", () => {
		it("should do nothing when an animation is active", () => {
			const womb = makeWomb();
			const animationInstance = new Animation(womb);

			Animation.animation = { name: "active", steps: [0] };
			Animation.wombImage = "media/ui/animation/active/0.png";
			animationInstance.onImage();

			expect(Animation.wombImage).toBe("media/ui/animation/active/0.png");
		});

		it("should set normal idle frame 0 when amount is zero", () => {
			const womb = makeWomb({ amount: 0, capacity: 1, pregnancy: null });
			const animationInstance = new Animation(womb);

			animationInstance.onImage();

			expect(Animation.wombImage).toBe("media/ui/womb/normal/womb_normal_0.png");
		});

		it("should set conception idle image when pregnancy progress is at or below 0.05", () => {
			const womb = makeWomb({
				pregnancy: { progress: 0.05 } as PregnancyData,
				amount: 0,
				capacity: 1
			});
			const animationInstance = new Animation(womb);

			animationInstance.onImage();

			expect(Animation.wombImage).toBe("media/ui/womb/conception/womb_conception_0.png");
		});

		it.each([
			{
				progress: 0.1,
				expectedIndex: 0
			},
			{
				progress: 0.95,
				expectedIndex: 6
			}
		])(
			"should set pregnant image to $expectedIndex whe progress is $progress",
			({ progress, expectedIndex }) => {
				const womb = makeWomb({ pregnancy: { progress } as PregnancyData });
				const animationInstance = new Animation(womb);

				animationInstance.onImage();

				expect(Animation.wombImage).toBe(
					`media/ui/womb/pregnant/womb_pregnant_${expectedIndex}.png`
				);
			}
		);
	});
});
