import { BirthOperationAllocator } from "@server/components/BirthOperationAllocator";
import { createDefaultBirthState } from "@shared/domain/birth/BirthState";

describe("BirthOperationAllocator", () => {
	const allocator = new BirthOperationAllocator();

	it("allocates the next persisted per-player sequence", () => {
		expect(allocator.allocate(createDefaultBirthState(), "character-uuid")).toEqual({
			changed: true,
			birthId: "character-uuid:birth:1",
			state: { birthSequence: 1, pendingBirthId: "character-uuid:birth:1" }
		});
	});

	it("returns an existing pending operation without advancing its sequence", () => {
		const current = { birthSequence: 4, pendingBirthId: "Dihgg:birth:4" };

		expect(allocator.allocate(current, "RenamedValueIsIgnored")).toEqual({
			changed: false,
			birthId: "Dihgg:birth:4",
			state: current
		});
	});
});
