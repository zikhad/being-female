import { pregnancyStateSchema } from "@shared/domain/pregnancy/PregnancySchema";
import {
	createDefaultPregnancyState,
	PregnancyStatus
} from "@shared/domain/pregnancy/PregnancyState";

describe("pregnancyStateSchema", () => {
	it("accepts default and fractional-progress Pregnancy states", () => {
		expect(pregnancyStateSchema(createDefaultPregnancyState())).toBe(true);
		expect(
			pregnancyStateSchema({
				status: PregnancyStatus.PREGNANT,
				current: 10,
				progress: 0.5,
				isInLabor: false
			})
		).toBe(true);
	});

	it.each([
		{},
		{ ...createDefaultPregnancyState(), status: "unknown" },
		{ ...createDefaultPregnancyState(), current: -1 },
		{ ...createDefaultPregnancyState(), progress: 1.1 },
		{ ...createDefaultPregnancyState(), progress: Number.NaN },
		{ ...createDefaultPregnancyState(), isInLabor: "yes" }
	])("rejects malformed state %#", value => {
		expect(pregnancyStateSchema(value)).toBe(false);
	});
});
