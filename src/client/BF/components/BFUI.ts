import { getText, IsoPlayer, require as pipewrenchRequire } from "@asledgehammer/pipewrench";
import * as Events from "@asledgehammer/pipewrench-events";
import { Lactation } from "@client/components/Lactation";
import { Pregnancy } from "@client/components/Pregnancy";
import { Womb } from "@client/components/Womb";
import { defaultBFUITabs, BFUITabContext } from "@client/components/UI/BFUITabs";

type UIProps = {
	lactation: Lactation;
	pregnancy: Pregnancy;
	womb: Womb;
};

export class BFUI {
	/** The player associated with this UI instance. */
	private player?: IsoPlayer;
	/** The lactation component associated with this UI instance. */
	private readonly lactation?: Lactation;
	/** The pregnancy component associated with this UI instance. */
	private readonly pregnancy?: Pregnancy;
	/** The womb component associated with this UI instance. */
	private readonly womb?: Womb;
	/** The default set of UI tabs for this instance. */
	private readonly tabs = defaultBFUITabs;

	/** Indicates whether the UI layout has been built. */
	private hasBuiltLayout = false;

	/** The tabbed UI instance associated with this UI. */
	private UI?: BFTabbedUI;

	constructor(props: UIProps) {
		this.lactation = props.lactation;
		this.pregnancy = props.pregnancy;
		this.womb = props.womb;

		Events.onCreateUI.addListener(() => this.onCreateUI());
		Events.onCreatePlayer.addListener((_, player) => this.onCreatePlayer(player));
		Events.onPlayerDeath.addListener(player => this.onPlayerDeath(player));
		Events.onPostRender.addListener(() => this.onUpdateUI());
	}

	/**
	 * Handler for the `onCreatePlayer` event. Initializes UI tabs for female players.
	 * @param player The created IsoPlayer instance
	 */
	private onCreatePlayer(player: IsoPlayer) {
		this.player = player;
		if (!this.UI) {
			this.onCreateUI();
		}
		if (!this.UI) return;
		if (!this.player?.isFemale()) return;
		if (this.hasBuiltLayout) return;
		const context = this.getTabContext();
		for (const tab of this.tabs) {
			const tabTitle = getText(tab.TITLE_KEY);
			this.UI.registerTab(tab.id, tabTitle);
			this.UI.setActiveTab(tabTitle);
			tab.build(this.UI, context);
		}

		this.UI.setBorderToAllElements(true);
		this.UI.saveLayout();
		if (this.tabs[0]) {
			this.UI.setActiveTab(getText(this.tabs[0].TITLE_KEY));
		}
		this.hasBuiltLayout = true;
	}

	/**
	 * Handles player death and removes this UI only when the tracked player dies.
	 * @param player The player instance reported by the death event.
	 */
	private onPlayerDeath(player: IsoPlayer) {
		if (!this.player || this.player !== player) return;
		this.onRemoveUI();
	}

	/**
	 * Initializes and configures the main BF UI when the UI subsystem is created.
	 */
	private onCreateUI() {
		pipewrenchRequire("BF/BFTabbedUI");
		this.UI = NewBFTabbedUI();
		this.hasBuiltLayout = false;

		this.UI.setWidthPixel(200);
		this.UI.setTitle(getText("IGUI_BF_UI_Panel"));
		this.UI.close();
	}

	/**
	 * Per-frame UI update hook. Refreshes registered tabs when UI is visible.
	 */
	private onUpdateUI() {
		if (!this.UI?.isUIVisible) return;
		const context = this.getTabContext();
		for (const tab of this.tabs) {
			tab.update(this.UI, context);
		}
	}

	/**
	 * Removes the current UI instance from the UI manager and resets layout state.
	 */
	private onRemoveUI() {
		if (!this.UI) return;

		this.UI.close();
		this.UI.removeFromUIManager();

		this.UI = undefined;
		this.hasBuiltLayout = false;
	}

	/**
	 * Builds the tab context object passed to each UI tab's build/update callbacks.
	 * @returns The `BFUITabContext` containing player and component references.
	 */
	private getTabContext(): BFUITabContext {
		return {
			player: this.player,
			lactation: this.lactation,
			pregnancy: this.pregnancy,
			womb: this.womb
		};
	}

	/**
	 * Toggle the visibility of the BF UI panel.
	 */
	public toggle() {
		if (!this.UI) return;
		this.UI.toggle();
	}

	/**
	 * Returns whether the BF UI is currently visible.
	 */
	public isVisible(): boolean {
		if (!this.UI) {
			return false;
		}

		return this.UI.isUIVisible;
	}
}
