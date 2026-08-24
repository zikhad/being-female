import {
	boolean,
	emptyRecord,
	integer,
	nonNegativeInteger,
	object,
	oneOf,
	positiveInteger,
	record,
	string
} from "@shared/validation/Schema";

describe("Schema validators", () => {
	it("validates boolean values", () => {
		expect(boolean(true)).toBe(true);
		expect(boolean(false)).toBe(true);
		expect(boolean(0)).toBe(false);
	});

	it.each([{}, [], { value: true }])("accepts record value %#", value => {
		expect(record(value)).toBe(true);
	});

	it.each([undefined, null, true, 1, "value"])("rejects non-record value %#", value => {
		expect(record(value)).toBe(false);
	});

	it("validates finite integers with inclusive bounds", () => {
		const bounded = integer({ minimum: 2, maximum: 4 });
		expect(bounded(2)).toBe(true);
		expect(bounded(4)).toBe(true);
		expect(bounded(1)).toBe(false);
		expect(bounded(5)).toBe(false);
		expect(bounded(2.5)).toBe(false);
		expect(bounded(Number.NaN)).toBe(false);
		expect(bounded(Number.POSITIVE_INFINITY)).toBe(false);
	});

	it("provides positive and non-negative integer validators", () => {
		expect(positiveInteger(1)).toBe(true);
		expect(positiveInteger(0)).toBe(false);
		expect(nonNegativeInteger(0)).toBe(true);
		expect(nonNegativeInteger(-1)).toBe(false);
	});

	it("validates bounded strings", () => {
		const bounded = string({ minimumLength: 1, maximumLength: 3 });
		expect(bounded("a")).toBe(true);
		expect(bounded("abc")).toBe(true);
		expect(bounded("")).toBe(false);
		expect(bounded("abcd")).toBe(false);
		expect(bounded(1)).toBe(false);
	});

	it("validates fixed value sets", () => {
		const status = oneOf(["OK", "ERROR"] as const);
		expect(status("OK")).toBe(true);
		expect(status("UNKNOWN")).toBe(false);
	});

	it("validates empty records", () => {
		expect(emptyRecord({})).toBe(true);
		expect(emptyRecord({ value: true })).toBe(false);
		expect(emptyRecord(null)).toBe(false);
	});

	it("validates required nested object properties while allowing additional fields", () => {
		type Example = { revision: number; data: { name: string } };
		const schema = object<Example>({
			revision: positiveInteger,
			data: object<Example["data"]>({ name: string({ minimumLength: 1 }) })
		});

		expect(schema({ revision: 1, data: { name: "value" }, future: true })).toBe(true);
		expect(schema({ revision: 0, data: { name: "value" } })).toBe(false);
		expect(schema({ revision: 1, data: {} })).toBe(false);
	});
});
