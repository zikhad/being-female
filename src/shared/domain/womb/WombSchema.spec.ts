import { wombCycleStateSchema, wombStateSchema } from "@shared/domain/womb/WombSchema";

describe("WombSchema", () => {
	it.each([{}, { cycleDay: -56 }, { cycleDay: 0 }, { cycleDay: 28 }])(
		"accepts persisted Womb state %#",
		value => expect(wombStateSchema(value)).toBe(true)
	);

	it.each([{ cycleDay: -57 }, { cycleDay: 29 }, { cycleDay: 1.5 }, { cycleDay: "1" }])(
		"rejects invalid concrete Womb state %#",
		value => expect(wombCycleStateSchema(value)).toBe(false)
	);

	it("requires a concrete cycle day in a client publication", () => {
		expect(wombCycleStateSchema({})).toBe(false);
	});
});
