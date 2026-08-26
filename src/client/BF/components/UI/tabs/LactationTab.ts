import { getText } from "@asledgehammer/pipewrench";
import { BFUITabContext, BFUITabDefinition } from "@client/components/UI/BFUITabDefinition";
import { valueInMilliliters } from "@client/Utils";

/**
 * Tab implementation for the Lactation tab.
 */
export class LactationTab extends BFUITabDefinition {
	readonly id = "Lactation";
	readonly TITLE_KEY = "IGUI_BF_UI_Lactation_Title";
	readonly ELEMENTS = {
		image: "lactation-image",
		title: "lactation-title",
		level: "lactation-level",
		amount: "lactation-amount"
	};

	build(ui: BFTabbedUI, context: BFUITabContext) {
		void context;
		ui.addImage(this.ELEMENTS.image, "media/ui/lactation/boobs/color-0/normal_empty.png");
		ui.nextLine();
		ui.addText(this.ELEMENTS.title, getText("IGUI_BF_UI_Milk_Amount"), undefined, "Center");
		ui.addImage(this.ELEMENTS.level, "media/ui/lactation/level/milk_level_0.png");
		ui.addText(this.ELEMENTS.amount, "0 ml", undefined, "Center");
	}

	update(ui: BFTabbedUI, context: BFUITabContext) {
		if (!context.lactation) return;
		const { images, milkAmount } = context.lactation;
		const { breasts, level } = images;
		ui[this.ELEMENTS.image]?.setPath(breasts);
		ui[this.ELEMENTS.level]?.setPath(level);
		ui[this.ELEMENTS.amount]?.setText(`${valueInMilliliters(milkAmount)} ml`);
	}
}
