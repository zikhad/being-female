/* eslint-disable @typescript-eslint/no-explicit-any */
import { mock } from "jest-mock-extended";
import { ZLBFUI } from "@client/components/ZLBFUI";
import * as Events from "@asledgehammer/pipewrench-events";
import * as Pipewrench from "@asledgehammer/pipewrench";
import { mockedPlayer } from "@test/mock";

jest.mock("@asledgehammer/pipewrench-events");

describe("ZLBFUI", () => {
	const addListener = jest.fn();
	const newTabbedUI = jest.fn();

	beforeEach(() => {
		addListener.mockClear();
		newTabbedUI.mockClear();
		(Pipewrench.require as jest.Mock).mockClear();

		Object.defineProperty(global, "NewZLBFTabbedUI", {
			writable: true,
			value: newTabbedUI.mockImplementation(() => ({
				isUIVisible: false,
				setWidthPixel: jest.fn(),
				setTitle: jest.fn(),
				setVisible: jest.fn(),
				removeFromUIManager: jest.fn(),
				registerTab: jest.fn(),
				setActiveTab: jest.fn(),
				addText: jest.fn(),
				nextLine: jest.fn(),
				addProgressBar: jest.fn(),
				addButton: jest.fn(),
				addImage: jest.fn(),
				setBorderToAllElements: jest.fn(),
				saveLayout: jest.fn(),
				open: jest.fn(),
				close: jest.fn(),
				toggle: jest.fn(),
				"lactation-image": {
					setPath: jest.fn(),
					setVisible: jest.fn(),
					setText: jest.fn(),
					setValue: jest.fn()
				},
				"lactation-level-image": {
					setPath: jest.fn(),
					setVisible: jest.fn(),
					setText: jest.fn(),
					setValue: jest.fn()
				},
				"womb-sperm-current-amount": {
					setPath: jest.fn(),
					setVisible: jest.fn(),
					setText: jest.fn(),
					setValue: jest.fn()
				},
				"womb-sperm-total-amount": {
					setPath: jest.fn(),
					setVisible: jest.fn(),
					setText: jest.fn(),
					setValue: jest.fn()
				},
				"womb-image": {
					setPath: jest.fn(),
					setVisible: jest.fn(),
					setText: jest.fn(),
					setValue: jest.fn()
				},
				"womb-cycle-phase-value": {
					setPath: jest.fn(),
					setVisible: jest.fn(),
					setText: jest.fn(),
					setValue: jest.fn()
				},
				"womb-fertility-title": {
					setPath: jest.fn(),
					setVisible: jest.fn(),
					setText: jest.fn(),
					setValue: jest.fn()
				},
				"womb-fertility-bar": {
					setPath: jest.fn(),
					setVisible: jest.fn(),
					setText: jest.fn(),
					setValue: jest.fn()
				},
				"womb-fertility-value": {
					setPath: jest.fn(),
					setVisible: jest.fn(),
					setText: jest.fn(),
					setValue: jest.fn()
				}
			}))
		});
	});

	describe("Event System", () => {
		it.each([
			{ event: "onCreateUI", handler: "onCreateUI" },
			{ event: "onCreatePlayer", handler: "onCreatePlayer" },
			{ event: "onPlayerDeath", handler: "onPlayerDeath" },
			{ event: "onPostRender", handler: "onUpdateUI" }
		])( "should register and call $event callback", ({ event, handler }) => {
			(Events as any)[event] = { addListener };

			const ui = new ZLBFUI({
				lactation: mock(),
				pregnancy: mock(),
				womb: mock()
			});

			(ui as any)[handler] = jest.fn();
			const spy = jest.spyOn(ui as any, handler);

			expect(addListener).toHaveBeenCalled();
			const [callback] = addListener.mock.calls[addListener.mock.calls.length - 1];
			callback();
			expect(spy).toHaveBeenCalled();
		});
	});

	describe("createUI", () => {
		let ui: ZLBFUI;

		beforeEach(() => {
			ui = new ZLBFUI({
				lactation: mock(),
				pregnancy: mock(),
				womb: mock()
			});
		});

		it("should require ZLBFTabbedUI before creating UI", () => {
			(ui as any).onCreateUI();

			expect(Pipewrench.require).toHaveBeenCalledWith("ZLBF/ZLBFTabbedUI");
			expect(newTabbedUI).toHaveBeenCalledTimes(1);
		});

		it.each([{ female: true }, { female: false }])(
			"should process onCreatePlayer for female=$female without throwing",
			({ female }) => {
				const isFemale = jest.fn().mockReturnValue(female);
				const player = mockedPlayer({ isFemale });
				(ui as any).onCreateUI();

				expect(() => (ui as any).onCreatePlayer(player)).not.toThrow();
				expect(isFemale).toHaveBeenCalled();
			}
		);

		it("should register tabs dynamically for female players", () => {
			const player = mockedPlayer({ isFemale: jest.fn().mockReturnValue(true) });
			(ui as any).onCreateUI();

			(ui as any).onCreatePlayer(player);

			const tabbedUI = newTabbedUI.mock.results[0].value;
			expect(tabbedUI.registerTab).toHaveBeenCalledTimes(2);
		});

		it("should not rebuild tabs when a new female character is created in the same session", () => {
			const firstPlayer = mockedPlayer({ isFemale: jest.fn().mockReturnValue(true) });
			const secondPlayer = mockedPlayer({ isFemale: jest.fn().mockReturnValue(true) });
			(ui as any).onCreateUI();

			(ui as any).onCreatePlayer(firstPlayer);
			(ui as any).onCreatePlayer(secondPlayer);

			const tabbedUI = newTabbedUI.mock.results[0].value;
			expect(tabbedUI.registerTab).toHaveBeenCalledTimes(2);
			expect(tabbedUI.saveLayout).toHaveBeenCalledTimes(1);
		});

		it("should return early if UI is not initialized", () => {
			const player = mockedPlayer({ isFemale: jest.fn().mockReturnValue(true) });
			const ui = new ZLBFUI({
				lactation: mock(),
				pregnancy: mock(),
				womb: mock()
			});

			expect(() => (ui as any).onCreatePlayer(player)).not.toThrow();
			// UI should not be set, so nothing should happen
		});

		it("should return early when onCreateUI does not produce a UI instance", () => {
			const player = mockedPlayer({ isFemale: jest.fn().mockReturnValue(true) });
			const ui = new ZLBFUI({
				lactation: mock(),
				pregnancy: mock(),
				womb: mock()
			});

			(ui as any).UI = undefined;
			(ui as any).onCreateUI = jest.fn();

			expect(() => (ui as any).onCreatePlayer(player)).not.toThrow();
			expect((ui as any).onCreateUI).toHaveBeenCalledTimes(1);
			expect((ui as any).UI).toBeUndefined();
			expect((ui as any).hasBuiltLayout).toBe(false);
		});

		it("should call setBorderToAllElements and saveLayout for female players", () => {
			const player = mockedPlayer({ isFemale: jest.fn().mockReturnValue(true) });
			(ui as any).onCreateUI();

			(ui as any).onCreatePlayer(player);

			const tabbedUI = newTabbedUI.mock.results[0].value;
			expect(tabbedUI.setBorderToAllElements).toHaveBeenCalledWith(true);
			expect(tabbedUI.saveLayout).toHaveBeenCalled();
		});

		it("should set active tab to first tab if tabs[0] exists", () => {
			const player = mockedPlayer({ isFemale: jest.fn().mockReturnValue(true) });
			(ui as any).onCreateUI();

			(ui as any).onCreatePlayer(player);

			const tabbedUI = newTabbedUI.mock.results[0].value;
			// setActiveTab should be called for the first tab at the end
			expect(tabbedUI.setActiveTab).toHaveBeenCalledWith(expect.any(String));
		});

		it("should not fail when tabs array is empty", () => {
			const player = mockedPlayer({ isFemale: jest.fn().mockReturnValue(true) });
			(ui as any).onCreateUI();
			(ui as any).tabs = [];

			expect(() => (ui as any).onCreatePlayer(player)).not.toThrow();

			const tabbedUI = newTabbedUI.mock.results[0].value;
			expect(tabbedUI.setBorderToAllElements).toHaveBeenCalledWith(true);
			expect(tabbedUI.saveLayout).toHaveBeenCalled();
		});
	});

	describe("Toggle UI", () => {
		it("should not throw when toggling before UI is created", () => {
			const ui = new ZLBFUI({
				lactation: mock(),
				pregnancy: mock(),
				womb: mock()
			});

			expect(() => ui.toggle()).not.toThrow();
		});

		it("should toggle the UI", () => {
			const ui = new ZLBFUI({
				lactation: mock(),
				pregnancy: mock(),
				womb: mock()
			});

			const toggleSpy = jest.fn();
			(ui as any).UI = {
				isUIVisible: true,
				toggle: toggleSpy
			};

			ui.toggle();

			expect(toggleSpy).toHaveBeenCalled();
		});

		it("should return false visibility when UI is not created", () => {
			const ui = new ZLBFUI({
				lactation: mock(),
				pregnancy: mock(),
				womb: mock()
			});

			expect(ui.isVisible()).toBe(false);
		});

		it("should return the underlying UI visibility", () => {
			const ui = new ZLBFUI({
				lactation: mock(),
				pregnancy: mock(),
				womb: mock()
			});

			(ui as any).UI = { isUIVisible: true };

			expect(ui.isVisible()).toBe(true);
		});
	});

	describe("Death Handling", () => {

		it("should teardown and remove UI when tracked player dies", () => {
			const ui = new ZLBFUI({
				lactation: mock(),
				pregnancy: mock(),
				womb: mock()
			});

			(ui as any).onCreateUI();
			const tabbedUI = newTabbedUI.mock.results[0].value;
			const closeCallsBeforeTeardown = tabbedUI.close.mock.calls.length;
			const trackedPlayer = mockedPlayer();
			(ui as any).player = trackedPlayer;

			(ui as any).onPlayerDeath(trackedPlayer);

			expect(tabbedUI.close).toHaveBeenCalledTimes(closeCallsBeforeTeardown + 1);
			expect(tabbedUI.removeFromUIManager).toHaveBeenCalledTimes(1);
			expect((ui as any).UI).toBeUndefined();
		});

		it("should ignore death events for other players", () => {
			const ui = new ZLBFUI({
				lactation: mock(),
				pregnancy: mock(),
				womb: mock()
			});

			(ui as any).onCreateUI();
			const tabbedUI = newTabbedUI.mock.results[0].value;
			const trackedPlayer = mockedPlayer();
			const otherPlayer = mockedPlayer();
			(ui as any).player = trackedPlayer;

			(ui as any).onPlayerDeath(otherPlayer);

			expect(tabbedUI.removeFromUIManager).not.toHaveBeenCalled();
			expect((ui as any).UI).toBeDefined();
		});

		it("should recreate UI after death teardown when a new player is created", () => {
			const ui = new ZLBFUI({
				lactation: mock(),
				pregnancy: mock(),
				womb: mock()
			});

			const deadPlayer = mockedPlayer({ isFemale: jest.fn().mockReturnValue(true) });
			const newPlayer = mockedPlayer({ isFemale: jest.fn().mockReturnValue(true) });

			(ui as any).onCreateUI();
			(ui as any).onCreatePlayer(deadPlayer);
			(ui as any).onPlayerDeath(deadPlayer);
			(ui as any).onCreatePlayer(newPlayer);

			expect(newTabbedUI).toHaveBeenCalledTimes(2);
			const recreatedUI = newTabbedUI.mock.results[1].value;
			expect(recreatedUI.registerTab).toHaveBeenCalledTimes(2);
			expect(recreatedUI.saveLayout).toHaveBeenCalledTimes(1);
		});

		it('should return early when the UI is not initialized', () => {
			const ui = new ZLBFUI({
				lactation: mock(),
				pregnancy: mock(),
				womb: mock()
			});

			const player = mockedPlayer();
			(ui as any).onCreatePlayer(player);
			(ui as any).UI = undefined;

			expect(() => (ui as any).onPlayerDeath(player)).not.toThrow();
		});
	});

	describe("Update UI", () => {

		it("should return early when UI is not visible", () => {
			const ui = new ZLBFUI({
				lactation: mock(),
				pregnancy: mock(),
				womb: mock()
			});

			(ui as any).UI = { isUIVisible: false };

			const tabUpdateSpy = jest.fn();
			(ui as any).tabs = [{ update: tabUpdateSpy }];

			(ui as any).onUpdateUI();

			expect(tabUpdateSpy).not.toHaveBeenCalled();
		});

		it("should call tab.update for each tab when UI is visible", () => {
			const ui = new ZLBFUI({
				lactation: mock(),
				pregnancy: mock(),
				womb: mock()
			});

			const tabUpdate1 = jest.fn();
			const tabUpdate2 = jest.fn();
			const tab1 = { update: tabUpdate1 };
			const tab2 = { update: tabUpdate2 };

			(ui as any).UI = { isUIVisible: true };
			(ui as any).tabs = [tab1, tab2];
			(ui as any).player = mockedPlayer();

			(ui as any).onUpdateUI();

			expect(tabUpdate1).toHaveBeenCalledWith((ui as any).UI, expect.any(Object));
			expect(tabUpdate2).toHaveBeenCalledWith((ui as any).UI, expect.any(Object));
		});

		it("should handle empty tabs without throwing", () => {
			const ui = new ZLBFUI({
				lactation: mock(),
				pregnancy: mock(),
				womb: mock()
			});

			(ui as any).UI = { isUIVisible: true };
			(ui as any).tabs = [];

			expect(() => (ui as any).onUpdateUI()).not.toThrow();
		});

		it("should pass correct context to tab.update", () => {
			const lactation = mock() as any;
			const pregnancy = mock() as any;
			const womb = mock() as any;
			const player = mockedPlayer();

			const ui = new ZLBFUI({
				lactation,
				pregnancy,
				womb
			});

			const tabUpdate = jest.fn();
			(ui as any).UI = { isUIVisible: true };
			(ui as any).tabs = [{ update: tabUpdate }];
			(ui as any).player = player;

			(ui as any).onUpdateUI();

			const [, context] = tabUpdate.mock.calls[0];
			expect(context.player).toBe(player);
			expect(context.lactation).toBe(lactation);
			expect(context.pregnancy).toBe(pregnancy);
			expect(context.womb).toBe(womb);
		});
	});
});
