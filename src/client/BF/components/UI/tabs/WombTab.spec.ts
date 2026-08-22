/* eslint-disable @typescript-eslint/no-explicit-any */
import { mock } from "jest-mock-extended";
import { WombTab } from "@client/components/UI/tabs/WombTab";
import { BFUITabContext } from "@client/components/UI/BFUITabDefinition";
import { Womb } from "@client/components/Womb";
import { mockedPlayer } from "@test/mock";
import { BFTraitsEnum } from "@constants";

jest.mock("@asledgehammer/pipewrench", () => ({
	getText: jest.fn().mockImplementation((key: string) => key),
	triggerEvent: jest.fn()
}));
jest.mock("@client/components/Player");
jest.mock("@client/components/Animation", () => ({
	Animation: { wombImage: "path/to/womb.png" }
}));

import { Player } from "@client/components/Player";
let mockHasTrait: jest.SpyInstance;
const tabElements = new WombTab().ELEMENTS;

const makeUI = () => ({
	addImage: jest.fn(),
	addText: jest.fn(),
	nextLine: jest.fn(),
	[tabElements.womb.image]: { setPath: jest.fn() },
	[tabElements.sperm.currentAmount]: { setText: jest.fn() },
	[tabElements.sperm.totalAmount]: { setText: jest.fn() },
	[tabElements.cycle.phaseValue]: { setText: jest.fn() },
	[tabElements.fertility.title]: { setText: jest.fn() },
	[tabElements.fertility.levelValue]: { setText: jest.fn() },
	[tabElements.fertility.levelImage]: { setPath: jest.fn() },
	[tabElements.fertility.eggImage]: { setPath: jest.fn() }
});

describe("WombTab", () => {
	let tab: WombTab;
	let ui: ReturnType<typeof makeUI>;

	beforeEach(() => {
		tab = new WombTab();
		ui = makeUI();
		mockHasTrait = jest.spyOn(Player, "hasTrait").mockReturnValue(false);
	});

	it("has correct id", () => {
		expect(tab.id).toBe("Womb");
	});

	it("has correct titleKey", () => {
		expect(tab.TITLE_KEY).toBe("IGUI_BF_UI_Womb_Title");
	});

	describe("build", () => {
		it("adds womb image, sperm info, and cycle phase elements", () => {
			tab.build(ui as any, {});

			expect(ui.addImage).toHaveBeenCalledWith(
				tabElements.womb.image,
				"media/ui/womb/normal/womb_normal_0.png"
			);
			expect(ui.addText).toHaveBeenCalledWith(
				tabElements.sperm.currentTitle,
				expect.any(String),
				undefined,
				"Center"
			);
			expect(ui.addText).toHaveBeenCalledWith(
				tabElements.sperm.totalTitle,
				expect.any(String),
				undefined,
				"Center"
			);
			expect(ui.addText).toHaveBeenCalledWith(
				tabElements.cycle.phaseTitle,
				expect.any(String),
				undefined,
				"Center"
			);
		});

		it("adds fertility section when player is not infertile", () => {
			mockHasTrait.mockReturnValue(false);
			const player = mockedPlayer();

			tab.build(ui as any, { player });

			expect(ui.addText).toHaveBeenCalledWith(
				tabElements.fertility.title,
				expect.any(String),
				undefined,
				"Center"
			);
			expect(ui.addText).toHaveBeenCalledWith(
				tabElements.fertility.levelValue,
				"100%",
				undefined,
				"Center"
			);
			expect(ui.addImage).toHaveBeenCalledWith(
				tabElements.fertility.levelImage,
				"media/ui/fertility/level/fertility_level_5.png"
			);
			expect(ui.addImage).toHaveBeenCalledWith(
				tabElements.fertility.eggImage,
				"media/ui/fertility/egg/egg_default.png",
				{ height: 26 }
			);
		});

		it("adds fertility section when no player is provided", () => {
			tab.build(ui as any, {});

			expect(ui.addText).toHaveBeenCalledWith(
				tabElements.fertility.title,
				expect.any(String),
				undefined,
				"Center"
			);
		});

		it("does NOT add fertility section when player has INFERTILE trait", () => {
			mockHasTrait.mockImplementation(
				(_player: any, trait: BFTraitsEnum) => trait === BFTraitsEnum.INFERTILE
			);
			const player = mockedPlayer();

			tab.build(ui as any, { player });

			expect(ui.addText).not.toHaveBeenCalledWith(
				tabElements.fertility.title,
				expect.any(String),
				undefined,
				"Center"
			);
		});
	});

	describe("update", () => {
		it("returns early when womb is not in context", () => {
			tab.update(ui as any, {});

			expect((ui as any)[tabElements.sperm.currentAmount].setText).not.toHaveBeenCalled();
		});

		it("updates sperm amounts, womb image, and cycle phase", () => {
			const womb = mock<Womb>();
			(womb as any).phaseTranslation = "IGUI_BF_UI_Phase_Ovulation";
			(womb as any).fertility = 0.5;
			(womb as any).amount = 0.25;
			(womb as any).total = 0.5;
			(womb as any).fertilityLevelStatus = 2;
			const player = mockedPlayer();
			mockHasTrait.mockReturnValue(false);

			const context: BFUITabContext = { womb, player };
			tab.update(ui as any, context);

			expect((ui as any)[tabElements.sperm.currentAmount].setText).toHaveBeenCalledWith(
				"250 ml"
			);
			expect((ui as any)[tabElements.sperm.totalAmount].setText).toHaveBeenCalledWith(
				"500 ml"
			);
			expect((ui as any)[tabElements.womb.image].setPath).toHaveBeenCalledWith(
				"path/to/womb.png"
			);
			expect((ui as any)[tabElements.cycle.phaseValue].setText).toHaveBeenCalledWith(
				"IGUI_BF_UI_Phase_Ovulation"
			);
		});

		it("updates fertility level UI when no pregnancy and player is not infertile", () => {
			const womb = mock<Womb>();
			(womb as any).phaseTranslation = "IGUI_TEST";
			(womb as any).fertility = 0.75;
			(womb as any).amount = 0;
			(womb as any).total = 0;
			(womb as any).fertilityLevelStatus = 4;
			const player = mockedPlayer();
			mockHasTrait.mockReturnValue(false);

			tab.update(ui as any, { womb, player });

			expect((ui as any)[tabElements.fertility.levelValue].setText).toHaveBeenCalledWith(
				"75%"
			);
			expect((ui as any)[tabElements.fertility.levelImage].setPath).toHaveBeenCalledWith(
				"media/ui/fertility/level/fertility_level_4.png"
			);
			expect((ui as any)[tabElements.fertility.eggImage].setPath).toHaveBeenCalledWith(
				"media/ui/fertility/egg/egg_default.png"
			);
		});

		it("updates fertility level value using pregnancy progress when pregnancy is active", () => {
			const womb = mock<Womb>();
			(womb as any).phaseTranslation = "IGUI_TEST";
			(womb as any).fertility = 0.5;
			(womb as any).amount = 0;
			(womb as any).total = 0;
			(womb as any).fertilityLevelStatus = "pregnant";
			const player = mockedPlayer();
			mockHasTrait.mockReturnValue(false);

			const pregnancy = mock<Womb["pregnancy"]>();
			(pregnancy as any).progress = 0.4;
			(womb as any).pregnancy = pregnancy;

			tab.update(ui as any, { womb, player, pregnancy: { pregnancy } as any });

			expect((ui as any)[tabElements.fertility.levelValue].setText).toHaveBeenCalledWith(
				"40%"
			);
		});

		it("skips fertility section when player has INFERTILE trait", () => {
			const womb = mock<Womb>();
			(womb as any).phaseTranslation = "IGUI_TEST";
			(womb as any).fertility = 0.9;
			(womb as any).amount = 0;
			(womb as any).total = 0;
			const player = mockedPlayer();
			mockHasTrait.mockImplementation(
				(_player: any, trait: BFTraitsEnum) => trait === BFTraitsEnum.INFERTILE
			);

			tab.update(ui as any, { womb, player });

			expect((ui as any)[tabElements.fertility.levelValue].setText).not.toHaveBeenCalled();
			expect((ui as any)[tabElements.fertility.levelImage].setPath).not.toHaveBeenCalled();
		});
	});
});
