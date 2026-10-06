import {
	addLactaidStimulation,
	addRemovalStimulation,
	applyMilkRemoval,
	decayStimulation,
	hungerFactor,
	hydrationFactor,
	lactationDuration,
	metabolicCostFor,
	requestedProduction
} from "@shared/domain/lactation/LactationBalance";

describe("LactationBalance", () => {
	it("calculates baseline daily production from the average rate", () => {
		expect(
			requestedProduction({
				baseRatePerMinute: 0.000525,
				elapsedMinutes: 1440,
				stimulation: 0,
				hasDairyCow: false,
				thirst: 0,
				hunger: 0
			})
		).toBeCloseTo(0.756);
	});

	it("applies stimulation, Dairy Cow, hydration, and hunger factors", () => {
		expect(
			requestedProduction({
				baseRatePerMinute: 1,
				elapsedMinutes: 1,
				stimulation: 0.5,
				hasDairyCow: true,
				thirst: 1,
				hunger: 1
			})
		).toBeCloseTo(1.5 * 1.25 * 0.25 * 0.5);
		expect(hydrationFactor(1)).toBe(0.25);
		expect(hungerFactor(1)).toBe(0.5);
	});

	it("adds and caps deterministic demand stimulation", () => {
		expect(addRemovalStimulation(0.1, 0.2)).toBeCloseTo(0.35);
		expect(addRemovalStimulation(0.4, 0.2)).toBe(0.5);
		expect(addLactaidStimulation(0.1)).toBeCloseTo(0.35);
		expect(addLactaidStimulation(0.4)).toBe(0.5);
	});

	it("decays stimulation by elapsed hours", () => {
		expect(decayStimulation(0.5, 600)).toBeCloseTo(0.25);
		expect(decayStimulation(0.5, 1200)).toBe(0);
	});

	it("applies Dairy Cow duration exactly once", () => {
		expect(lactationDuration(168, false)).toBe(168);
		expect(lactationDuration(168, true)).toBe(210);
	});

	it("derives metabolic costs from actual produced liters", () => {
		expect(metabolicCostFor(0.5)).toEqual({
			calories: 320,
			carbohydrates: 16,
			lipids: 16,
			proteins: 8,
			thirst: 0.1
		});
	});

	it("uses actual milk removal and refreshes duration", () => {
		expect(
			applyMilkRemoval(
				{ isActive: true, milkAmount: 0.1, expiration: 4, multiplier: 0.2 },
				0.2,
				168
			)
		).toEqual({
			isActive: true,
			milkAmount: 0,
			expiration: 168,
			multiplier: 0.325
		});
	});
});
