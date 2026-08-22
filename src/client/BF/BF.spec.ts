import { lactation, womb, pregnancy, UI } from "@client/BF";

jest.mock("@client/components/Lactation");
jest.mock("@client/components/Womb");
jest.mock("@client/components/Pregnancy");
jest.mock("@client/components/ContextMenu");
jest.mock("@client/components/BFUI");

describe("BF", () => {
	it.each([
		{ name: "Lactation", component: lactation },
		{ name: "Pregnancy", component: pregnancy },
		{ name: "Womb", component: womb },
		{ name: "UI", component: UI }
	])("$name should be defined", ({ component }) => {
		expect(component).toBeDefined();
	});
});
