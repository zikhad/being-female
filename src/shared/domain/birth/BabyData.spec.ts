import { babyDataSchema, createBabyData } from "@shared/domain/birth/BabyData";

describe("BabyData", () => {
	it("creates valid immutable identity metadata from server-owned inputs", () => {
		const data = createBabyData({ username: "Dihgg", name: "Jane Doe" }, 3);

		expect(data).toEqual({
			schemaVersion: 1,
			birthId: "Dihgg:birth:3",
			motherUsername: "Dihgg",
			motherName: "Jane Doe",
			birthSequence: 3
		});
		expect(babyDataSchema(data)).toBe(true);
	});

	it.each([
		undefined,
		{},
		{ schemaVersion: 1, birthId: "Dihgg:birth:0", motherUsername: "Dihgg", birthSequence: 0 },
		{ schemaVersion: 1, birthId: "", motherUsername: "Dihgg", birthSequence: 1 }
	])("rejects malformed metadata %#", value => {
		expect(babyDataSchema(value)).toBe(false);
	});
});
