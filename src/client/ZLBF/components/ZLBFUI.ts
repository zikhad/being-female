import { getText, IsoPlayer, require as pipewrenchRequire } from "@asledgehammer/pipewrench";
import * as Events from "@asledgehammer/pipewrench-events";
import { Lactation } from "@client/components/Lactation";
import { Pregnancy } from "@client/components/Pregnancy";
import { Womb } from "@client/components/Womb";
import { defaultZLBFUITabs, ZLBFUITabContext } from "@client/components/UI/ZLBFUITabs";

type UIProps = {
	lactation: Lactation;
	pregnancy: Pregnancy;
	womb: Womb;
};

export class ZLBFUI {
	private player?: IsoPlayer;
	private readonly lactation?: Lactation;
	private readonly pregnancy?: Pregnancy;
	private readonly womb?: Womb;
	private readonly tabs = defaultZLBFUITabs;

	private UI?: ZLBFTabbedUI;

	constructor(props: UIProps) {
		this.lactation = props.lactation;
		this.pregnancy = props.pregnancy;
		this.womb = props.womb;

		Events.onCreateUI.addListener(() => this.onCreateUI());
		Events.onCreatePlayer.addListener((_, player) => this.onCreatePlayer(player));
		Events.onPostRender.addListener(() => this.onUpdateUI());
	}

	private onCreatePlayer(player: IsoPlayer) {
	/**
	 * Handler for the `onCreatePlayer` event. Initializes UI tabs for female players.
	 * @param player The created IsoPlayer instance
	 */
	private onCreatePlayer(player: IsoPlayer) {
		this.player = player;
		if (!this.UI) return;
		if (!this.player?.isFemale()) return;
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
	}

	/**
	 * Initializes and configures the main ZLBF UI when the UI subsystem is created.
	 */
	private onCreateUI() {
		pipewrenchRequire("ZLBF/ZLBFTabbedUI");
		this.UI = NewZLBFTabbedUI();

		this.UI.setWidthPixel(200);
		this.UI.setTitle(getText("IGUI_ZLBF_UI_Panel"));
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
	 * Builds the tab context object passed to each UI tab's build/update callbacks.
	 * @returns The `ZLBFUITabContext` containing player and component references.
	 */
	private getTabContext(): ZLBFUITabContext {
		return {
			player: this.player,
			lactation: this.lactation,
			pregnancy: this.pregnancy,
			womb: this.womb
		};
	}

	/**
	 * Toggle the visibility of the ZLBF UI panel.
	 */
	public toggle() {
		if (!this.UI) return;
		this.UI.toggle();
	}

	/**
	 * Returns whether the ZLBF UI is currently visible.
	 */
	public isVisible(): boolean {
		if (!this.UI) {
			return false;
		}

		return this.UI.isUIVisible;
	}
}
