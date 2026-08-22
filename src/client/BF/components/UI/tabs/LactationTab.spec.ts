/* eslint-disable @typescript-eslint/no-explicit-any */
import { LactationTab } from "@client/components/UI/tabs/LactationTab";
import { BFUITabContext } from "@client/components/UI/BFUITabDefinition";
import { mock } from "jest-mock-extended";
import { Lactation } from "@client/components/Lactation";

jest.mock("@asledgehammer/pipewrench", () => ({
	getText: jest.fn().mockImplementation((key: string) => key)
}));

const tabElements = new LactationTab().ELEMENTS;

const makeUI = () => ({
	addImage: jest.fn(),
	addText: jest.fn(),
	nextLine: jest.fn(),
	[tabElements.image]: { setPath: jest.fn() },
	[tabElements.level]: { setPath: jest.fn() }
});

const addSizedImage = (ui: Pick<BFTabbedUI, "addImage">) => {
	ui.addImage("test-image", "media/ui/test.png", { width: 128, height: 64 });
};

const addWidthOnlyImage = (ui: Pick<BFTabbedUI, "addImage">) => {
	ui.addImage("test-image", "media/ui/test.png", { width: 128 });
};

const addHeightOnlyImage = (ui: Pick<BFTabbedUI, "addImage">) => {
	ui.addImage("test-image", "media/ui/test.png", { height: 64 });
};

describe("LactationTab", () => {
	let tab: LactationTab;
	let ui: ReturnType<typeof makeUI>;

	beforeEach(() => {
		tab = new LactationTab();
		ui = makeUI();
	});

	it("has correct id", () => {
		expect(tab.id).toBe("Lactation");
	});

	it("has correct titleKey", () => {
		expect(tab.TITLE_KEY).toBe("IGUI_BF_UI_Lactation_Title");
	});

	describe("build", () => {
		it("adds boob image, title text, and level image", () => {
			tab.build(ui as any, {});

			expect(ui.addImage).toHaveBeenCalledWith(
				tabElements.image,
				"media/ui/lactation/boobs/color-0/normal_empty.png"
			);
			expect(ui.addImage).toHaveBeenCalledWith(
				tabElements.level,
				"media/ui/lactation/level/milk_level_0.png"
			);
			expect(ui.addText).toHaveBeenCalledWith(
				tabElements.title,
				expect.any(String),
				undefined,
				"Center"
			);
			expect(ui.nextLine).toHaveBeenCalled();
		});

		it("accepts addImage options with width and height", () => {
			const addImage = jest.fn();

			addSizedImage({ addImage } as Pick<BFTabbedUI, "addImage">);

			expect(addImage).toHaveBeenCalledWith("test-image", "media/ui/test.png", {
				width: 128,
				height: 64
			});
		});

		it("accepts width-only addImage options", () => {
			const addImage = jest.fn();

			addWidthOnlyImage({ addImage } as Pick<BFTabbedUI, "addImage">);

			expect(addImage).toHaveBeenCalledWith("test-image", "media/ui/test.png", {
				width: 128
			});
		});

		it("accepts height-only addImage options", () => {
			const addImage = jest.fn();

			addHeightOnlyImage({ addImage } as Pick<BFTabbedUI, "addImage">);

			expect(addImage).toHaveBeenCalledWith("test-image", "media/ui/test.png", {
				height: 64
			});
		});
	});

	describe("update", () => {
		it("returns early when lactation is not in context", () => {
			tab.update(ui as any, {});

			expect((ui as any)[tabElements.image].setPath).not.toHaveBeenCalled();
			expect((ui as any)[tabElements.level].setPath).not.toHaveBeenCalled();
		});

		it("updates breast and level images from lactation context", () => {
			const lactation = mock<Lactation>();
			(lactation as any).images = {
				breasts: "path/to/breasts.png",
				level: "path/to/level.png"
			};

			const context: BFUITabContext = { lactation };
			tab.update(ui as any, context);

			expect((ui as any)[tabElements.image].setPath).toHaveBeenCalledWith(
				"path/to/breasts.png"
			);
			expect((ui as any)[tabElements.level].setPath).toHaveBeenCalledWith(
				"path/to/level.png"
			);
		});
	});
});
