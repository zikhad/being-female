import { babyDataSchema, createBabyData } from "@shared/domain/birth/BabyData";

describe("BabyData", () => {
	const valid = {
		schemaVersion: 1,
		birthId: "character-uuid:birth:1",
		motherCharacterId: "character-uuid",
		motherUsername: "Dihgg",
		motherName: "Jane Doe",
		birthSequence: 1
	};

	it("creates valid immutable identity metadata from server-owned inputs", () => {
		const data = createBabyData({
			birthId: "legacy-operation-id",
			motherCharacterId: "character-uuid",
			mother: { username: "Dihgg", name: "Jane Doe" },
			birthSequence: 3
		});

		expect(data).toEqual({
			schemaVersion: 1,
			birthId: "legacy-operation-id",
			motherCharacterId: "character-uuid",
			motherUsername: "Dihgg",
			motherName: "Jane Doe",
			birthSequence: 3
		});
		expect(babyDataSchema(data)).toBe(true);
	});

	it.each([
		undefined,
		{},
		{ ...valid, schemaVersion: 2 },
		{ ...valid, birthSequence: 0 },
		{ ...valid, birthId: "" }
	])("rejects malformed metadata %#", value => {
		expect(babyDataSchema(value)).toBe(false);
	});

	it.each([
		["missing", undefined],
		["empty", ""],
		["longer than 64 characters", "x".repeat(65)]
	])("rejects a %s motherCharacterId", (_case, motherCharacterId) => {
		expect(babyDataSchema({ ...valid, motherCharacterId })).toBe(false);
	});
});
