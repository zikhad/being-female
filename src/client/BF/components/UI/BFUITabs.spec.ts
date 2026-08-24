import {
	defaultBFUITabs,
	LactationTab,
	WombTab,
	BFUITabDefinition
} from "@client/components/UI/BFUITabs";

describe("BFUITabDefinition", () => {
	it("can be subclassed with concrete implementations", () => {
		class TestTab extends BFUITabDefinition {
			readonly id = "Test";
			readonly TITLE_KEY = "IGUI_TEST";
			readonly ELEMENTS = { test: "test-element" };
			build = jest.fn();
			update = jest.fn();
		}

		const tab = new TestTab();
		expect(tab.id).toBe("Test");
		expect(tab.TITLE_KEY).toBe("IGUI_TEST");
		expect(tab).toBeInstanceOf(BFUITabDefinition);
	});

	it("exposes build and update as callable methods", () => {
		class TestTab extends BFUITabDefinition {
			readonly id = "Test";
			readonly TITLE_KEY = "IGUI_TEST";
			readonly ELEMENTS = { test: "test-element" };
			build = jest.fn();
			update = jest.fn();
		}

		const tab = new TestTab();
		const mockUI = {} as BFTabbedUI;
		const mockCtx = {};

		tab.build(mockUI, mockCtx as any);
		tab.update(mockUI, mockCtx as any);

		expect(tab.build).toHaveBeenCalledWith(mockUI, mockCtx);
		expect(tab.update).toHaveBeenCalledWith(mockUI, mockCtx);
	});
});

describe("defaultBFUITabs", () => {
	it("contains exactly 2 tabs", () => {
		expect(defaultBFUITabs).toHaveLength(2);
	});

	it("first tab is WombTab", () => {
		expect(defaultBFUITabs[0]).toBeInstanceOf(WombTab);
	});

	it("second tab is LactationTab", () => {
		expect(defaultBFUITabs[1]).toBeInstanceOf(LactationTab);
	});

	it("each tab is an instance of BFUITabDefinition", () => {
		for (const tab of defaultBFUITabs) {
			expect(tab).toBeInstanceOf(BFUITabDefinition);
		}
	});

	it("tab ids are unique", () => {
		const ids = defaultBFUITabs.map(t => t.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});
