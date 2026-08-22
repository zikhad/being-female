import { percentageToNumber, valueInMilliliters, createArray, repeatArray } from "@client/Utils";

describe("Utils", () => {
	describe("percentageToNumber", () => {
		it.each([
			{ num: 10, max: 100, expected: 10 },
			{ num: 10, max: 10, expected: 1 },
			{ num: 20, max: 10, expected: 2 }
		])(
			"should return $expected when number is $num and max is $max",
			({ num, max, expected }) => {
				const result = percentageToNumber(num, max);
				expect(result).toBe(expected);
			}
		);
	});
});

describe("valueInMilliliters", () => {
	it("formats 0 as 0 ml", () => {
		expect(valueInMilliliters(0)).toBe("0 ml");
	});

	it("formats 1 as 1000 ml", () => {
		expect(valueInMilliliters(1)).toBe("1000 ml");
	});

	it("formats 0.25 as 250 ml", () => {
		expect(valueInMilliliters(0.25)).toBe("250 ml");
	});

	it("rounds to nearest integer", () => {
		expect(valueInMilliliters(0.1234)).toBe("123 ml");
		expect(valueInMilliliters(0.126)).toBe("126 ml");
		expect(valueInMilliliters(0.999)).toBe("999 ml");
	});

	it("handles negative values", () => {
		expect(valueInMilliliters(-0.5)).toBe("-500 ml");
	});
});
