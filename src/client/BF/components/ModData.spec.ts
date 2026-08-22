import { mock } from "jest-mock-extended";
import { ModData } from "@client/components/ModData";

describe("ModData", () => {
	let mockObject: ModData<unknown>["object"];
	let modData: Record<string, unknown>;

	beforeEach(() => {
		modData = {};
		mockObject = mock({
			getModData: jest.fn(() => modData)
		});
	});

	it("returns defaultData if modKey is not present", () => {
		const defaultData = { foo: "bar" };
		const pd = new ModData({
			object: mockObject,
			modKey: "testKey",
			defaultData
		});
		expect(pd.data).toBe(defaultData);
		expect(modData["testKey"]).toBe(defaultData);
	});

	it("returns existing data if modKey is present", () => {
		const existingData = { foo: "baz" };
		modData["testKey"] = existingData;
		const pd = new ModData({
			object: mockObject,
			modKey: "testKey",
			defaultData: { foo: "bar" }
		});
		expect(pd.data).toBe(existingData);
	});

	it("sets defaultData only once if accessed multiple times", () => {
		const defaultData = { foo: "bar" };
		const pd = new ModData({
			object: mockObject,
			modKey: "testKey",
			defaultData
		});
		const first = pd.data;
		const second = pd.data;
		expect(first).toBe(second);
		expect(modData["testKey"]).toBe(defaultData);
	});

	it("works with primitive types as defaultData", () => {
		const pd = new ModData({
			object: mockObject,
			modKey: "numKey",
			defaultData: 42
		});
		expect(pd.data).toBe(42);
	});

	it("does not overwrite existing data with defaultData", () => {
		modData["testKey"] = "existing";
		const pd = new ModData({
			object: mockObject,
			modKey: "testKey",
			defaultData: "default"
		});
		expect(pd.data).toBe("existing");
		expect(modData["testKey"]).toBe("existing");
	});

	it("Should be able to write data back to ModData", () => {
		const pd = new ModData({
			object: mockObject,
			modKey: "testKey",
			defaultData: "default"
		});
		expect(pd.data).toBe("default");
		pd.data = "something else";
		expect(pd.data).toBe("something else");
	});
});
