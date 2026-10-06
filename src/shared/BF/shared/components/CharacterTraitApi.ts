import type { IsoPlayer } from "@asledgehammer/pipewrench";

/**
 * Build 42 trait operations for IsoPlayer.
 */
export class CharacterTraitApi {
	/**
	 * Normalizes a trait ID by trimming whitespace, converting to lowercase, and removing "base:" prefix if present.
	 * @param value The trait ID to normalize
	 * @returns The normalized trait ID
	 */
	private static normalizeTraitId(value: string): string {
		const normalized = value.trim().toLowerCase();
		return normalized.startsWith("base:") ? normalized.slice(5) : normalized;
	}

	/**
	 * Resolves a trait ID to a Build 42 CharacterTraitRef object, if it exists.
	 * @param traitId The trait ID to resolve
	 * @returns The CharacterTraitRef object if found, otherwise undefined
	 */
	private static resolveTrait(traitId: string): CharacterTraitRef | undefined {
		const traitLocation = ResourceLocation.of(this.normalizeTraitId(traitId));
		return CharacterTrait.get(traitLocation);
	}

	/**
	 * Checks if a given Build 42 CharacterTraitRef matches the provided trait ID.
	 * @param trait The trait to check
	 * @param traitId The trait ID to match against
	 * @returns True if the trait matches the trait ID, otherwise false
	 */
	private static matchesTraitId(trait: CharacterTraitRef, traitId: string): boolean {
		const normalizedTraitId = this.normalizeTraitId(traitId);

		const traitName = trait.getName();
		if (traitName && this.normalizeTraitId(traitName) === normalizedTraitId) {
			return true;
		}

		const traitString = trait.toString();

		return !!traitString && this.normalizeTraitId(traitString) === normalizedTraitId;
	}

	/**
	 * Checks if the known traits list contains a trait matching the given ID.
	 * @param knownTraits The list of known traits to search
	 * @param traitId The trait ID to look for
	 * @returns True if a matching trait is found, otherwise false
	 */
	private static hasKnownTrait(knownTraits: KnownTraitList, traitId: string): boolean {
		for (let index = 0; index < knownTraits.size(); index += 1) {
			if (this.matchesTraitId(knownTraits.get(index), traitId)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Returns the Build 42 CharacterTraits container.
	 * @param player The player whose CharacterTraits container to retrieve
	 * @returns The CharacterTraits container for the specified player
	 */
	public static getCharacterTraits(
		player: IsoPlayer
	): ReturnType<IsoPlayer["getCharacterTraits"]> {
		return player.getCharacterTraits();
	}

	/**
	 * Checks whether a player has the given trait using Build 42 APIs.
	 * @param player The player to check
	 * @param traitId The trait ID to check for
	 * @returns True if the player has the trait, false otherwise
	 */
	public static hasTrait(player: IsoPlayer, traitId: string): boolean {
		const characterTraits = this.getCharacterTraits(player);
		const trait = this.resolveTrait(traitId);

		if (trait) {
			return characterTraits.get(trait);
		}

		return this.hasKnownTrait(characterTraits.getKnownTraits(), traitId);
	}

	/**
	 * Adds a trait to the specified player using Build 42 trait objects.
	 * The operation is idempotent and does not append an already-present trait.
	 * @param player The player to add the trait to
	 * @param traitId The trait ID to add
	 */
	public static addTrait(player: IsoPlayer, traitId: string): void {
		const characterTraits = this.getCharacterTraits(player);
		const trait = this.resolveTrait(traitId);

		if (trait && !characterTraits.get(trait)) {
			characterTraits.add(trait);
		}
	}

	/**
	 * Removes a trait from the specified player using Build 42 trait objects.
	 * @param player The player to remove the trait from
	 * @param traitId The trait ID to remove
	 */
	public static removeTrait(player: IsoPlayer, traitId: string): void {
		const characterTraits = this.getCharacterTraits(player);
		const trait = this.resolveTrait(traitId);

		if (trait) {
			characterTraits.remove(trait);
		}
	}
}
