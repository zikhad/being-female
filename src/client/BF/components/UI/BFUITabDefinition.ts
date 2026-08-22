import { IsoPlayer } from "@asledgehammer/pipewrench";
import { Lactation } from "@client/components/Lactation";
import { Pregnancy } from "@client/components/Pregnancy";
import { Womb } from "@client/components/Womb";

/**
 * Context object passed to each UI tab, containing relevant player and system state.
 *
 * @property player - The current IsoPlayer instance (if available).
 * @property lactation - The current Lactation state (if available).
 * @property pregnancy - The current Pregnancy state (if available).
 * @property womb - The current Womb state (if available).
 */
export type BFUITabContext = {
	player?: IsoPlayer;
	lactation?: Lactation;
	pregnancy?: Pregnancy;
	womb?: Womb;
};

/**
 * Abstract base class for a UI tab in the BF system.
 *
 * Extend this class to implement a new tab. Each tab must define its unique id, TITLE_KEY,
 * and implement the build and update methods.
 */
export abstract class BFUITabDefinition {
	/** Unique identifier for the tab. */
	abstract readonly id: string;
	/** Translation key for the tab's title. */
	abstract readonly TITLE_KEY: string;

	/** Mapping of UI element identifiers to their keys. */
	abstract readonly ELEMENTS: Record<string, string | Record<string, string>>;
	/**
	 * Build the tab's static UI elements.
	 * @param ui - The tabbed UI instance.
	 * @param context - The context for this tab.
	 */
	abstract build(ui: BFTabbedUI, context: BFUITabContext): void;
	/**
	 * Update the tab's dynamic content.
	 * @param ui - The tabbed UI instance.
	 * @param context - The context for this tab.
	 */
	abstract update(ui: BFTabbedUI, context: BFUITabContext): void;
}
