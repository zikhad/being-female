import { CharacterTraitApi } from "@shared/components/CharacterTraitApi";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { mockedPlayer } from "@test/mock";

describe("CharacterTraitApi", () => {
	describe("getCharacterTraits", () => {
		it("should return the CharacterTraits container from the player", () => {
			const mockCharacterTraits = {
				get: jest.fn(),
				add: jest.fn(),
				remove: jest.fn(),
				getKnownTraits: jest.fn()
			};
			const player = mockedPlayer({
				getCharacterTraits: jest.fn().mockReturnValue(mockCharacterTraits)
			});

			const result = CharacterTraitApi.getCharacterTraits(player);

			expect(result).toBe(mockCharacterTraits);
			expect(player.getCharacterTraits).toHaveBeenCalled();
		});
	});

	describe("hasTrait", () => {
		it("should return true when player has a resolved trait", () => {
			const mockTrait = { getName: () => "strength", toString: () => "strength" };

			(globalThis as any).CharacterTrait = {
				get: jest.fn().mockReturnValue(mockTrait)
			};

			const mockCharacterTraits = {
				get: jest.fn().mockReturnValue(true),
				getKnownTraits: jest.fn().mockReturnValue({
					size: jest.fn().mockReturnValue(0),
					get: jest.fn()
				}),
				add: jest.fn(),
				remove: jest.fn()
			};

			const player = mockedPlayer({
				getCharacterTraits: jest.fn().mockReturnValue(mockCharacterTraits)
			});

			const result = CharacterTraitApi.hasTrait(player, "strength");

			expect(result).toBe(true);
			expect(mockCharacterTraits.get).toHaveBeenCalledWith(mockTrait);
		});

		it("should return false when player does not have a resolved trait", () => {
			const mockTrait = { getName: () => "strength", toString: () => "strength" };

			(globalThis as any).CharacterTrait = {
				get: jest.fn().mockReturnValue(mockTrait)
			};

			const mockCharacterTraits = {
				get: jest.fn().mockReturnValue(false),
				getKnownTraits: jest.fn().mockReturnValue({
					size: jest.fn().mockReturnValue(0),
					get: jest.fn()
				}),
				add: jest.fn(),
				remove: jest.fn()
			};

			const player = mockedPlayer({
				getCharacterTraits: jest.fn().mockReturnValue(mockCharacterTraits)
			});

			const result = CharacterTraitApi.hasTrait(player, "strength");

			expect(result).toBe(false);
		});

		it("should check known traits when resolved trait is not found", () => {
			const mockKnownTrait = {
				getName: () => "illiterate",
				toString: () => "illiterate"
			};

			(globalThis as any).CharacterTrait = {
				get: jest.fn().mockReturnValue(undefined)
			};

			const mockCharacterTraits = {
				get: jest.fn(),
				getKnownTraits: jest.fn().mockReturnValue({
					size: jest.fn().mockReturnValue(1),
					get: jest.fn().mockReturnValue(mockKnownTrait)
				}),
				add: jest.fn(),
				remove: jest.fn()
			};

			const player = mockedPlayer({
				getCharacterTraits: jest.fn().mockReturnValue(mockCharacterTraits)
			});

			const result = CharacterTraitApi.hasTrait(player, "illiterate");

			expect(result).toBe(true);
			expect(mockCharacterTraits.getKnownTraits).toHaveBeenCalled();
		});

		it("should normalize trait IDs - trim and lowercase", () => {
			const mockTrait = { getName: () => "strength", toString: () => "strength" };

			(globalThis as any).CharacterTrait = {
				get: jest.fn().mockReturnValue(mockTrait)
			};

			const mockCharacterTraits = {
				get: jest.fn().mockReturnValue(true),
				getKnownTraits: jest.fn().mockReturnValue({
					size: jest.fn().mockReturnValue(0),
					get: jest.fn()
				}),
				add: jest.fn(),
				remove: jest.fn()
			};

			const player = mockedPlayer({
				getCharacterTraits: jest.fn().mockReturnValue(mockCharacterTraits)
			});

			const result = CharacterTraitApi.hasTrait(player, "  STRENGTH  ");

			expect(result).toBe(true);
			expect((globalThis as any).ResourceLocation.of).toHaveBeenCalledWith("strength");
		});

		it("should normalize trait IDs - remove base: prefix", () => {
			const mockTrait = { getName: () => "strength", toString: () => "strength" };

			(globalThis as any).CharacterTrait = {
				get: jest.fn().mockReturnValue(mockTrait)
			};

			const mockCharacterTraits = {
				get: jest.fn().mockReturnValue(true),
				getKnownTraits: jest.fn().mockReturnValue({
					size: jest.fn().mockReturnValue(0),
					get: jest.fn()
				}),
				add: jest.fn(),
				remove: jest.fn()
			};

			const player = mockedPlayer({
				getCharacterTraits: jest.fn().mockReturnValue(mockCharacterTraits)
			});

			const result = CharacterTraitApi.hasTrait(player, "base:strength");

			expect(result).toBe(true);
			expect((globalThis as any).ResourceLocation.of).toHaveBeenCalledWith("strength");
		});

		it("should handle known traits with matching name", () => {
			const mockKnownTrait = {
				getName: () => "Illiterate",
				toString: () => "illiterate"
			};

			(globalThis as any).CharacterTrait = {
				get: jest.fn().mockReturnValue(undefined)
			};

			const mockCharacterTraits = {
				get: jest.fn(),
				getKnownTraits: jest.fn().mockReturnValue({
					size: jest.fn().mockReturnValue(1),
					get: jest.fn().mockReturnValue(mockKnownTrait)
				}),
				add: jest.fn(),
				remove: jest.fn()
			};

			const player = mockedPlayer({
				getCharacterTraits: jest.fn().mockReturnValue(mockCharacterTraits)
			});

			const result = CharacterTraitApi.hasTrait(player, "illiterate");

			expect(result).toBe(true);
		});

		it("should return false when trait not found in known traits", () => {
			(globalThis as any).CharacterTrait = {
				get: jest.fn().mockReturnValue(undefined)
			};

			const mockCharacterTraits = {
				get: jest.fn(),
				getKnownTraits: jest.fn().mockReturnValue({
					size: jest.fn().mockReturnValue(0),
					get: jest.fn()
				}),
				add: jest.fn(),
				remove: jest.fn()
			};

			const player = mockedPlayer({
				getCharacterTraits: jest.fn().mockReturnValue(mockCharacterTraits)
			});

			const result = CharacterTraitApi.hasTrait(player, "nonexistent");

			expect(result).toBe(false);
		});
	});

	describe("addTrait", () => {
		it("should add a resolved trait to the player", () => {
			const mockTrait = { getName: () => "strength", toString: () => "strength" };

			(globalThis as any).CharacterTrait = {
				get: jest.fn().mockReturnValue(mockTrait)
			};

			const mockCharacterTraits = {
				get: jest.fn(),
				getKnownTraits: jest.fn(),
				add: jest.fn(),
				remove: jest.fn()
			};

			const player = mockedPlayer({
				getCharacterTraits: jest.fn().mockReturnValue(mockCharacterTraits)
			});

			CharacterTraitApi.addTrait(player, "strength");

			expect(mockCharacterTraits.add).toHaveBeenCalledWith(mockTrait);
		});

		it("should not add trait when trait cannot be resolved", () => {
			(globalThis as any).CharacterTrait = {
				get: jest.fn().mockReturnValue(undefined)
			};

			const mockCharacterTraits = {
				get: jest.fn(),
				getKnownTraits: jest.fn(),
				add: jest.fn(),
				remove: jest.fn()
			};

			const player = mockedPlayer({
				getCharacterTraits: jest.fn().mockReturnValue(mockCharacterTraits)
			});

			CharacterTraitApi.addTrait(player, "nonexistent");

			expect(mockCharacterTraits.add).not.toHaveBeenCalled();
		});

		it("should not add a resolved trait that is already present", () => {
			const mockTrait = { getName: () => "strength", toString: () => "strength" };

			(globalThis as any).CharacterTrait = {
				get: jest.fn().mockReturnValue(mockTrait)
			};

			const mockCharacterTraits = {
				get: jest.fn().mockReturnValue(true),
				getKnownTraits: jest.fn(),
				add: jest.fn(),
				remove: jest.fn()
			};

			const player = mockedPlayer({
				getCharacterTraits: jest.fn().mockReturnValue(mockCharacterTraits)
			});

			CharacterTraitApi.addTrait(player, "strength");

			expect(mockCharacterTraits.get).toHaveBeenCalledWith(mockTrait);
			expect(mockCharacterTraits.add).not.toHaveBeenCalled();
		});

		it("should normalize trait ID before adding", () => {
			const mockTrait = { getName: () => "strength", toString: () => "strength" };

			(globalThis as any).CharacterTrait = {
				get: jest.fn().mockReturnValue(mockTrait)
			};

			const mockCharacterTraits = {
				get: jest.fn(),
				getKnownTraits: jest.fn(),
				add: jest.fn(),
				remove: jest.fn()
			};

			const player = mockedPlayer({
				getCharacterTraits: jest.fn().mockReturnValue(mockCharacterTraits)
			});

			CharacterTraitApi.addTrait(player, "  BASE:STRENGTH  ");

			expect((globalThis as any).ResourceLocation.of).toHaveBeenCalledWith("strength");
			expect(mockCharacterTraits.add).toHaveBeenCalledWith(mockTrait);
		});
	});

	describe("removeTrait", () => {
		it("should remove a resolved trait from the player", () => {
			const mockTrait = { getName: () => "strength", toString: () => "strength" };

			(globalThis as any).CharacterTrait = {
				get: jest.fn().mockReturnValue(mockTrait)
			};

			const mockCharacterTraits = {
				get: jest.fn(),
				getKnownTraits: jest.fn(),
				add: jest.fn(),
				remove: jest.fn()
			};

			const player = mockedPlayer({
				getCharacterTraits: jest.fn().mockReturnValue(mockCharacterTraits)
			});

			CharacterTraitApi.removeTrait(player, "strength");

			expect(mockCharacterTraits.remove).toHaveBeenCalledWith(mockTrait);
		});

		it("should not remove trait when trait cannot be resolved", () => {
			(globalThis as any).CharacterTrait = {
				get: jest.fn().mockReturnValue(undefined)
			};

			const mockCharacterTraits = {
				get: jest.fn(),
				getKnownTraits: jest.fn(),
				add: jest.fn(),
				remove: jest.fn()
			};

			const player = mockedPlayer({
				getCharacterTraits: jest.fn().mockReturnValue(mockCharacterTraits)
			});

			CharacterTraitApi.removeTrait(player, "nonexistent");

			expect(mockCharacterTraits.remove).not.toHaveBeenCalled();
		});

		it("should normalize trait ID before removing", () => {
			const mockTrait = { getName: () => "strength", toString: () => "strength" };

			(globalThis as any).CharacterTrait = {
				get: jest.fn().mockReturnValue(mockTrait)
			};

			const mockCharacterTraits = {
				get: jest.fn(),
				getKnownTraits: jest.fn(),
				add: jest.fn(),
				remove: jest.fn()
			};

			const player = mockedPlayer({
				getCharacterTraits: jest.fn().mockReturnValue(mockCharacterTraits)
			});

			CharacterTraitApi.removeTrait(player, "  BASE:STRENGTH  ");

			expect((globalThis as any).ResourceLocation.of).toHaveBeenCalledWith("strength");
			expect(mockCharacterTraits.remove).toHaveBeenCalledWith(mockTrait);
		});
	});

	describe("trait ID normalization edge cases", () => {
		it("should handle multiple whitespace correctly", () => {
			const mockTrait = { getName: () => "strength", toString: () => "strength" };

			(globalThis as any).CharacterTrait = {
				get: jest.fn().mockReturnValue(mockTrait)
			};

			const mockCharacterTraits = {
				get: jest.fn().mockReturnValue(true),
				getKnownTraits: jest.fn().mockReturnValue({
					size: jest.fn().mockReturnValue(0),
					get: jest.fn()
				}),
				add: jest.fn(),
				remove: jest.fn()
			};

			const player = mockedPlayer({
				getCharacterTraits: jest.fn().mockReturnValue(mockCharacterTraits)
			});

			CharacterTraitApi.hasTrait(player, "   \t STRENGTH \n  ");

			expect((globalThis as any).ResourceLocation.of).toHaveBeenCalledWith("strength");
		});

		it("should handle base: prefix with various cases", () => {
			const mockTrait = { getName: () => "strength", toString: () => "strength" };

			(globalThis as any).CharacterTrait = {
				get: jest.fn().mockReturnValue(mockTrait)
			};

			const mockCharacterTraits = {
				get: jest.fn().mockReturnValue(true),
				getKnownTraits: jest.fn().mockReturnValue({
					size: jest.fn().mockReturnValue(0),
					get: jest.fn()
				}),
				add: jest.fn(),
				remove: jest.fn()
			};

			const player = mockedPlayer({
				getCharacterTraits: jest.fn().mockReturnValue(mockCharacterTraits)
			});

			CharacterTraitApi.hasTrait(player, "BASE:STRENGTH");

			expect((globalThis as any).ResourceLocation.of).toHaveBeenCalledWith("strength");
		});

		it("should handle empty string gracefully", () => {
			(globalThis as any).CharacterTrait = {
				get: jest.fn().mockReturnValue(undefined)
			};

			const mockCharacterTraits = {
				get: jest.fn(),
				getKnownTraits: jest.fn().mockReturnValue({
					size: jest.fn().mockReturnValue(0),
					get: jest.fn()
				}),
				add: jest.fn(),
				remove: jest.fn()
			};

			const player = mockedPlayer({
				getCharacterTraits: jest.fn().mockReturnValue(mockCharacterTraits)
			});

			const result = CharacterTraitApi.hasTrait(player, "");

			expect(result).toBe(false);
		});
	});

	describe("known traits matching", () => {
		it("should match known traits by name (case-insensitive)", () => {
			const mockKnownTrait = {
				getName: () => "Illiterate",
				toString: () => "Base:Illiterate"
			};

			(globalThis as any).CharacterTrait = {
				get: jest.fn().mockReturnValue(undefined)
			};

			const mockCharacterTraits = {
				get: jest.fn(),
				getKnownTraits: jest.fn().mockReturnValue({
					size: jest.fn().mockReturnValue(1),
					get: jest.fn().mockReturnValue(mockKnownTrait)
				}),
				add: jest.fn(),
				remove: jest.fn()
			};

			const player = mockedPlayer({
				getCharacterTraits: jest.fn().mockReturnValue(mockCharacterTraits)
			});

			const result = CharacterTraitApi.hasTrait(player, "ILLITERATE");

			expect(result).toBe(true);
		});

		it("should match known traits by toString (case-insensitive, with base: removal)", () => {
			const mockKnownTrait = {
				getName: () => null,
				toString: () => "Base:Weak"
			};

			(globalThis as any).CharacterTrait = {
				get: jest.fn().mockReturnValue(undefined)
			};

			const mockCharacterTraits = {
				get: jest.fn(),
				getKnownTraits: jest.fn().mockReturnValue({
					size: jest.fn().mockReturnValue(1),
					get: jest.fn().mockReturnValue(mockKnownTrait)
				}),
				add: jest.fn(),
				remove: jest.fn()
			};

			const player = mockedPlayer({
				getCharacterTraits: jest.fn().mockReturnValue(mockCharacterTraits)
			});

			const result = CharacterTraitApi.hasTrait(player, "weak");

			expect(result).toBe(true);
		});

		it("should iterate through multiple known traits", () => {
			const mockTrait1 = {
				getName: () => "strength",
				toString: () => "strength"
			};

			const mockTrait2 = {
				getName: () => "weak",
				toString: () => "weak"
			};

			(globalThis as any).CharacterTrait = {
				get: jest.fn().mockReturnValue(undefined)
			};

			const mockKnownTraits = {
				size: jest.fn().mockReturnValue(2),
				get: jest.fn().mockReturnValueOnce(mockTrait1).mockReturnValueOnce(mockTrait2)
			};

			const mockCharacterTraits = {
				get: jest.fn(),
				getKnownTraits: jest.fn().mockReturnValue(mockKnownTraits),
				add: jest.fn(),
				remove: jest.fn()
			};

			const player = mockedPlayer({
				getCharacterTraits: jest.fn().mockReturnValue(mockCharacterTraits)
			});

			const result = CharacterTraitApi.hasTrait(player, "weak");

			expect(result).toBe(true);
			expect(mockKnownTraits.get).toHaveBeenCalledWith(0);
			expect(mockKnownTraits.get).toHaveBeenCalledWith(1);
		});
	});
});
