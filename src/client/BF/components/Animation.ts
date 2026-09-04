import { ZombRandBetween, getTexture } from "@asledgehammer/pipewrench";
import * as Events from "@asledgehammer/pipewrench-events";
import { Womb } from "@client/components/Womb";
import { percentageToNumber } from "@client/Utils";
import { ITEMS, BFEventsEnum } from "@constants";
import {
	ANIMATIONS,
	AnimationSetting,
	AnimationSettings,
	animationRegistry
} from "@client/components/AnimationRegistry";

export { ANIMATIONS, AnimationSetting } from "@client/components/AnimationRegistry";

/**
 * Payload sent when an animation event fires.
 * @property animation - Which animation to play.
 * @property duration  - Total duration of the animation cycle in milliseconds.
 * @property delta     - Normalized playback position within the current cycle (0–1).
 * @property custom      - Optional override for default animation settings (frame steps, loop count, fullness support).
 */
export type AnimationUpdateConfig = {
	duration: number;
	delta: number;
};

/**
 * Manages womb image rendering for both animated scenes and idle still frames.
 *
 * The current image path is stored in the static {@link Animation.wombImage} property
 * so that UI components can read it without holding a direct reference to this instance.
 *
 * Subscribes to three game events via {@link BFEventsEnum}:
 * - `ANIMATION_START` → {@link onAnimationStart} — initializes the animation.
 * - `ANIMATION`      → {@link onAnimation}  — updates the frame for the active scene.
 * - `ANIMATION_STOP` → {@link onAnimationStop} — marks the animation as inactive.
 * - `IMAGE`          → {@link onImage}       — refreshes the idle womb image.
 */
export class Animation {
	/** The current womb image path, shared across all consumers. */
	public static wombImage: string = "media/ui/womb/normal/womb_normal_0.png";
	/** The current animation settings, shared across all consumers. */
	public static animation: AnimationSetting | undefined;

	/** Manifest-loaded animation settings currently available for each animation type. */
	static readonly availableAnimations: AnimationSettings = animationRegistry.animations;
	/** Compatibility alias retained for integrations that previously read the default arrays. */
	static readonly defaultAnimations: AnimationSettings = Animation.availableAnimations;

	/**
	 * @param womb - The {@link Womb} instance used to read reproductive state (amount, capacity, pregnancy, active items).
	 */
	constructor(private readonly womb: Womb) {
		new Events.EventEmitter(BFEventsEnum.ANIMATION_START).addListener((animation: ANIMATIONS) =>
			this.onAnimationStart(animation)
		);
		new Events.EventEmitter<(data: AnimationUpdateConfig) => void>(
			BFEventsEnum.ANIMATION_UPDATE
		).addListener(data => this.onAnimation(data));
		new Events.EventEmitter(BFEventsEnum.ANIMATION_STOP).addListener(() =>
			this.onAnimationStop()
		);
		new Events.EventEmitter(BFEventsEnum.IMAGE).addListener(() => this.onImage());
	}

	/**
	 * Filters the available animation variants based on the player's current reproductive state.
	 * @param animations The array of animation settings to filter.
	 * @returns The filtered array of animation settings that match the player's current reproductive state.
	 */
	private filterVariants(animations: AnimationSetting[]) {
		const hasCondom = this.womb.hasItem(ITEMS.CONDOM);
		const isPregnant = this.pregnancyStatus === "pregnant";
		const fullness = this.fullness;

		return animations.filter(({ condom, pregnancy, fullnessSupport, birth, fertilization }) => {
			if (birth) return true; /** Birth animations are always available when triggered */
			if (fertilization)
				return true; /** Fertilization animations are always available when triggered */

			if (isPregnant && pregnancy !== true)
				return false; /** Is pregnant but variant does not support it */
			if (!isPregnant && pregnancy === true)
				return false; /** Is not pregnant but variant requires it */
			if (hasCondom && condom !== true)
				return false; /** Requires condom but variant does not support it */
			if (!hasCondom && condom === true)
				return false; /** Does not require condom but variant requires it */

			if (fullnessSupport && !fullnessSupport.includes(fullness))
				return false; /** Fullness does not match */

			return true;
		});
	}

	/**
	 * Preloads all frame textures for the given animation to prevent flickering.
	 * Calls pcall(getTexture, path) for each step across all applicable fullness variants.
	 */
	private preloadFrames({
		name,
		path = "media/ui/animation",
		steps,
		fullnessSupport = []
	}: AnimationSetting) {
		const variantsToLoad: (string | null)[] =
			fullnessSupport.length > 0 ? fullnessSupport : [null];
		for (const variant of variantsToLoad) {
			const basePath = [path, name, variant].filter(part => part !== null).join("/");
			for (const step of steps) {
				pcall(getTexture, `${basePath}/${step}.png`);
			}
		}
	}

	/**
	 * Returns the current fullness state of the womb ("full" or "empty").
	 * @returns "full" if the amount exceeds half of the capacity, otherwise "empty".
	 */
	private get fullness() {
		return this.womb.amount > this.womb.capacity / 2 ? "full" : "empty";
	}

	/**
	 * Returns the player's current reproductive pregnancyStatus for still-image selection.
	 * - `"pregnant"` when pregnancy progress exceeds 5 %.
	 * - `"conception"` when pregnant but progress ≤ 5 %.
	 * - `"normal"` when there is no active pregnancy.
	 */
	private get pregnancyStatus() {
		const pregnancy = this.womb.pregnancyData;
		if (!pregnancy) return "normal";
		if (pregnancy.progress > 0.05) return "pregnant";
		return "conception";
	}

	/**
	 * Computes the zero-based frame index for the idle still image.
	 *
	 * - Clamps pregnancy progress to 1 at 90 %+ and maps it to frames 0–6.
	 * - When no pregnancy, maps sperm fill percentage to frames 1–17 (0 if empty).
	 */
	private get imageIndex() {
		const { amount, capacity } = this.womb;
		const pregnancy = this.womb.pregnancyData;
		if (pregnancy && pregnancy.progress > 0.05) {
			const percentage = (pregnancy.progress > 0.9 ? 1 : pregnancy.progress) * 100;
			return percentageToNumber(percentage, 6);
		}
		if (amount === 0) return 0;
		const percentage = Math.floor((amount / capacity) * 100);
		const index = percentageToNumber(percentage, 17);
		return Math.max(1, index);
	}

	/**
	 * Selects and preloads a named or custom animation that matches the current womb state.
	 * @param animation Built-in animation key or concrete custom animation settings.
	 */
	onAnimationStart(animation: ANIMATIONS | AnimationSetting) {
		if (typeof animation === "string") {
			const animationVariants = Animation.availableAnimations[animation];
			if (!animationVariants || animationVariants.length === 0) {
				Animation.animation = undefined;
				return;
			}

			const selectableVariants = this.filterVariants(animationVariants);
			if (selectableVariants.length === 0) {
				Animation.animation = undefined;
				return;
			}
			const variantIndex = ZombRandBetween(0, selectableVariants.length - 1);

			Animation.animation = selectableVariants[variantIndex] ?? selectableVariants[0];
		} else {
			Animation.animation = this.filterVariants([animation])[0];
		}

		if (Animation.animation !== undefined) {
			this.preloadFrames(Animation.animation);
		}
	}

	/**
	 * Event that updates the image of womb animated version
	 * @param delta Animation delta time
	 * @param duration The duration of the animation
	 * */
	onAnimation({ delta, duration }: AnimationUpdateConfig) {
		if (!Animation.animation) return;

		const {
			name,
			path = `media/ui/animation`,
			steps,
			loop = 1,
			fullnessSupport = []
		} = Animation.animation;

		const loopDuration = duration / loop;
		const currentLoopDelta = (delta * duration) % loopDuration;
		const stepDuration = loopDuration / steps.length;
		const stepIndex = Math.floor(currentLoopDelta / stepDuration) % steps.length;
		const step = steps[stepIndex];

		const fullness = this.fullness;
		const fullnessPath = fullnessSupport.includes(fullness) ? fullness : null;

		const finalPath = [path, name, fullnessPath].filter(part => part !== null).join("/");
		Animation.wombImage = `${finalPath}/${step}.png`;
	}

	/** Marks the active animation as finished and re-enables idle image updates. */
	onAnimationStop() {
		Animation.animation = undefined;
	}

	/**
	 * Event that updates the still image of Womb
	 */
	onImage() {
		if (Animation.animation) return;
		Animation.wombImage = `media/ui/womb/${this.pregnancyStatus}/womb_${this.pregnancyStatus}_${this.imageIndex}.png`;
	}
}
