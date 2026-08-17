/** @noResolution */

/**
 * Build 42 type declarations.
 * Augments zombie.characters.Stats with the new CharacterStat-based API
 * and declares CharacterStat as a global.
 */

import { Fluid } from "@shared/components/FluidContainerApi";

/** Opaque type representing a CharacterStat enum value (Java-backed). */
declare type CharacterStatValue = { readonly __brand: "CharacterStatValue" };

declare global {
	/**
	 * Build 42 CharacterStat enum - global accessible from Lua.
	 * Replaces legacy direct stat getter/setter methods on Stats.
	 */
	const CharacterStat: {
		readonly ANGER: CharacterStatValue;
		readonly BOREDOM: CharacterStatValue;
		readonly DISCOMFORT: CharacterStatValue;
		readonly ENDURANCE: CharacterStatValue;
		readonly FATIGUE: CharacterStatValue;
		readonly FITNESS: CharacterStatValue;
		readonly FOOD_SICKNESS: CharacterStatValue;
		readonly HUNGER: CharacterStatValue;
		readonly IDLENESS: CharacterStatValue;
		readonly INTOXICATION: CharacterStatValue;
		readonly MORALE: CharacterStatValue;
		readonly NICOTINE_WITHDRAWAL: CharacterStatValue;
		readonly PAIN: CharacterStatValue;
		readonly PANIC: CharacterStatValue;
		readonly POISON: CharacterStatValue;
		readonly SANITY: CharacterStatValue;
		readonly SICKNESS: CharacterStatValue;
		readonly STRESS: CharacterStatValue;
		readonly TEMPERATURE: CharacterStatValue;
		readonly THIRST: CharacterStatValue;
		readonly UNHAPPINESS: CharacterStatValue;
		readonly WETNESS: CharacterStatValue;
		readonly ZOMBIE_FEVER: CharacterStatValue;
		readonly ZOMBIE_INFECTION: CharacterStatValue;
	};

	interface CharacterTraitRef {
		getName: () => string;
		toString: () => string;
	}

	type KnownTraitList = {
		size(): number;
		get(index: number): CharacterTraitRef;
	};

	const CharacterTrait: {
		get: (this: void, id: unknown) => CharacterTraitRef | undefined;
	};

	const ResourceLocation: {
		of: (this: void, id: string) => unknown;
	};

	interface ProceduralDistributionEntry {
		items: unknown[];
	}

	interface ProceduralDistributionRegistry {
		list: Record<string, ProceduralDistributionEntry>;
	}

	interface ZLBFSandboxOptions {
		PregnancyDuration?: number;
		PregnancyRecovery?: number;
		WombMaxCapacity?: number;
		MilkCapacity?: number;
		MilkExpiration?: number;
	}

	const ProceduralDistributions: ProceduralDistributionRegistry;

	const ISContextMenu: {
		getNew: (context: unknown) => never;
	};

	/** Fluid container interface */
	interface FluidContainer {
		removeFluid(amount?: number): void;
		addFluid(type: string, amount: number): void;
		getAmount(): number;
		getCapacity(): number;
		isFull(): boolean;
		isEmpty(): boolean;
		getFreeCapacity(): number;
		getPrimaryFluid(): Fluid;
	}
}

declare module "@asledgehammer/pipewrench" {
	export namespace HaloTextHelper {
		function addGoodText(player: IsoPlayer, text: string): void;
		function addBadText(player: IsoPlayer, text: string): void;
	}

	export namespace zombie.inventory {
		interface InventoryItem {
			getFluidContainer?(): FluidContainer | null;
			/** Broadcasts authoritative mutable item fields to the owning client. */
			syncItemFields(): void;
		}

		interface ItemContainer {
			getFirstAvailableFluidContainer(type: string): InventoryItem | null;
		}
	}
	export namespace zombie.characters {
		interface IsoGameCharacter$CharacterTraits {
			get(trait: CharacterTraitRef): boolean;
			add(trait: CharacterTraitRef): void;
			remove(trait: CharacterTraitRef): void;
			getKnownTraits(): KnownTraitList;
		}

		interface Stats {
			get(stat: CharacterStatValue): number;
			set(stat: CharacterStatValue, value: number): void;
			add(stat: CharacterStatValue, amount: number): boolean;
			remove(stat: CharacterStatValue, amount: number): boolean;
			reset(stat: CharacterStatValue): void;
			getEnduranceWarning(): number;
			isAboveMinimum(stat: CharacterStatValue): boolean;
		}
	}

	export namespace zombie.characters.traits {
		interface TraitCollection {
			add(trait: CharacterTraitRef): void;
			remove(trait: CharacterTraitRef): boolean;
		}
	}
}

declare const SandboxVars: Record<string, string | number> & {
	ZLBF?: ZLBFSandboxOptions;
};

type ProceduralDistributionList = Record<string, ProceduralDistributionEntry | undefined>;

declare const ProceduralDistributions: {
	list: ProceduralDistributionList;
};

export {};
