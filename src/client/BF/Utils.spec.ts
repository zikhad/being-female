import { percentageToNumber, valueInMilliliters } from "@client/Utils";

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
	it.each([
		{
			description: "should return 0 when value is 0",
			value: 0,
			expected: 0
		},
		{
			description: "should return 1000 when value is 1",
			value: 1,
			expected: 1000
		},
		{
			description: "should return 250 when value is 0.25",
			value: 0.25,
			expected: 250
		},
		{
			description: "should round to nearest integer",
			value: 0.1234,
			expected: 123
		},
		{
			description: "should round to nearest integer",
			value: 0.126,
			expected: 126
		},
		{
			description: "should round to nearest integer",
			value: 0.999,
			expected: 999
		},
		{
			description: "should handle negative values",
			value: -0.5,
			expected: -500
		}
	])("$description", ({ value, expected }) => {
		const result = valueInMilliliters(value);
		expect(result).toBe(expected);
	});
});
