import { lactationStateSchema } from "@shared/domain/lactation/LactationSchema";

describe("LactationSchema", () => {
	it("accepts a complete Lactation state", () => {
		expect(
			lactationStateSchema({
				isActive: true,
				milkAmount: 0.4,
				expiration: 12,
				multiplier: 0.2
			})
		).toBe(true);
	});

	it.each([-1, Number.NaN, "0.2"])("rejects invalid milk amount %#", milkAmount => {
		expect(
			lactationStateSchema({ isActive: true, milkAmount, expiration: 12, multiplier: 0.2 })
		).toBe(false);
	});
});
