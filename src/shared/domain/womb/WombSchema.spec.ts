import { wombProgressStateSchema, wombStateSchema } from "@shared/domain/womb/WombSchema";

describe("WombSchema", () => {
	it.each([-56, 0, 28])("accepts complete persisted Womb state %#", cycleDay => {
		expect(wombStateSchema({ cycleDay, amount: 0, total: 0, onContraceptive: false })).toBe(
			true
		);
	});

	it.each([{}, { cycleDay: 0 }, { cycleDay: 0, amount: 0, total: 0 }])(
		"rejects incomplete persisted Womb state %#",
		value => expect(wombStateSchema(value)).toBe(false)
	);

	it.each([{ cycleDay: -57 }, { cycleDay: 29 }, { cycleDay: 1.5 }, { cycleDay: "1" }])(
		"rejects invalid concrete Womb state %#",
		value =>
			expect(
				wombProgressStateSchema({
					amount: 0,
					total: 0,
					...value
				})
			).toBe(false)
	);

	it.each([
		{ cycleDay: 1, amount: -0.1, total: 0 },
		{ cycleDay: 1, amount: 3.1, total: 0 },
		{ cycleDay: 1, amount: 0, total: -1 }
	])("rejects invalid Womb values %#", value => {
		expect(wombProgressStateSchema(value)).toBe(false);
	});

	it("requires every concrete field in a client publication", () => {
		expect(wombProgressStateSchema({ cycleDay: 1 })).toBe(false);
	});
});
