import { getText } from "@asledgehammer/pipewrench";
import { BFUITabContext, BFUITabDefinition } from "@client/components/UI/BFUITabDefinition";

/**
 * Tab implementation for the Lactation tab.
 */
export class LactationTab extends BFUITabDefinition {
	readonly id = "Lactation";
	readonly TITLE_KEY = "IGUI_BF_UI_Lactation_Title";
	readonly ELEMENTS = {
		image: "lactation-image",
		title: "lactation-title",
		level: "lactation-level"
	};

	build(ui: BFTabbedUI, context: BFUITabContext) {
		ui.addImage(this.ELEMENTS.image, "media/ui/lactation/boobs/color-0/normal_empty.png");
		ui.nextLine();
		ui.addText(this.ELEMENTS.title, getText("IGUI_BF_UI_Milk_Amount"), undefined, "Center");
		ui.addImage(this.ELEMENTS.level, "media/ui/lactation/level/milk_level_0.png");
	}

	update(ui: BFTabbedUI, context: BFUITabContext) {
		if (!context.lactation) return;
		const { breasts, level } = context.lactation.images;
		ui[this.ELEMENTS.image]?.setPath(breasts);
		ui[this.ELEMENTS.level]?.setPath(level);
	}
}
