/**
 * Map of all procedural distribution tables by name.
 */
type ProceduralDistributionList = Record<string, ProceduralDistributionEntry | undefined>;

/**
 * Configuration for injecting a custom item into procedural distribution tables.
 */
type DistributionRule = {
	/** The type of the item to inject */
	readonly itemType: string;
	/** The spawn chance weight for the item in the distribution table */
	readonly chance: number;
	/** The names of the procedural distribution tables to inject the item into */
	readonly tableNames: readonly string[];
};

/**
 * Compact item definition used when several items share the same target tables.
 */
type DistributionItem = {
	readonly itemType: string;
	readonly chance: number;
};

/**
 * Higher-level grouped definition for location-based loot rules.
 */
type DistributionGroup = {
	readonly tableNames: readonly string[];
	readonly items: readonly DistributionItem[];
};

/**
 * Named groups of procedural distribution tables for reusability and clarity.
 */
const TABLE_GROUPS = {
	/** Bathroom-related distribution tables */
	bathroom: ["BathroomCabinet", "BathroomCounter", "BathroomShelf"],
	/** Bedroom side table distribution tables */
	bedroomSideTables: ["BedroomSidetable", "BedroomSidetableClassy", "BedroomSidetableRedneck"],
	/** Bedroom dresser distribution tables */
	bedroomDressers: ["BedroomDresser", "BedroomDresserClassy", "BedroomDresserRedneck"],
	/** Hospital-related distribution tables */
	hospital: ["HospitalRoomCounter", "HospitalRoomShelves", "MedicalClinicDrugs"],
	/** Hospital room-specific distribution tables */
	hospitalRoom: ["HospitalRoomCounter", "HospitalRoomShelves"],
	/** Store-related distribution tables */
	store: ["GigamartHousewares"],
	/** Trash bin distribution tables */
	trashBins: [
		"BinBar",
		"BinBathroom",
		"BinCrepe",
		"BinDumpster",
		"BinFireStation",
		"BinGeneric",
		"BinHospital",
		"BinJays",
		"BinSpiffos",
		"SafehouseBin",
		"SafehouseBin_Mid",
		"SafehouseBin_Late"
	],
	/** Drug-related distribution tables */
	drugLocations: ["DrugShackDrugs", "DerelictHouseDrugs"]
} as const;

const createDistributionRules = (
	groups: readonly DistributionGroup[]
): readonly DistributionRule[] => {
	return groups.flatMap(group =>
		group.items.map(item => ({
			itemType: item.itemType,
			chance: item.chance,
			tableNames: group.tableNames
		}))
	);
};

/**
 * Default distribution rules for all BF custom items.
 * Defines which items spawn in which procedural loot tables and at what chance weight.
 */
const BF_DISTRIBUTION_GROUPS: readonly DistributionGroup[] = [
	{
		tableNames: TABLE_GROUPS.bathroom,
		items: [
			{ itemType: "BF.Contraceptive", chance: 21 },
			{ itemType: "BF.Lactaid", chance: 14 },
			{ itemType: "BF.Condom", chance: 28 },
			{ itemType: "BF.CondomBox", chance: 26 },
			{ itemType: "BF.VaginalDouche", chance: 10 }
		]
	},
	{
		tableNames: TABLE_GROUPS.bedroomSideTables,
		items: [
			{ itemType: "BF.Contraceptive", chance: 14 },
			{ itemType: "BF.Lactaid", chance: 7 }
		]
	},
	{
		tableNames: [...TABLE_GROUPS.bedroomDressers, ...TABLE_GROUPS.bedroomSideTables],
		items: [
			{ itemType: "BF.Condom", chance: 28 },
			{ itemType: "BF.CondomBox", chance: 14 }
		]
	},
	{
		tableNames: [...TABLE_GROUPS.bedroomSideTables, "BedroomDresserChild"],
		items: [{ itemType: "BF.BreastPump", chance: 14 }]
	},
	{
		tableNames: TABLE_GROUPS.hospital,
		items: [
			{ itemType: "BF.Contraceptive", chance: 21 },
			{ itemType: "BF.Lactaid", chance: 18 },
			{ itemType: "BF.Condom", chance: 18 }
		]
	},
	{
		tableNames: TABLE_GROUPS.hospitalRoom,
		items: [
			{ itemType: "BF.CondomBox", chance: 14 },
			{ itemType: "BF.BreastPump", chance: 18 },
			{ itemType: "BF.VaginalDouche", chance: 14 }
		]
	},
	{
		tableNames: TABLE_GROUPS.store,
		items: [
			{ itemType: "BF.Contraceptive", chance: 18 },
			{ itemType: "BF.Lactaid", chance: 14 },
			{ itemType: "BF.Condom", chance: 21 },
			{ itemType: "BF.CondomBox", chance: 28 },
			{ itemType: "BF.BreastPump", chance: 14 },
			{ itemType: "BF.VaginalDouche", chance: 10 }
		]
	},
	{
		tableNames: TABLE_GROUPS.trashBins,
		items: [{ itemType: "BF.CondomUsed", chance: 28 }]
	},
	{
		tableNames: TABLE_GROUPS.drugLocations,
		items: [
			{ itemType: "BF.Contraceptive", chance: 10 },
			{ itemType: "BF.Lactaid", chance: 7 },
			{ itemType: "BF.Condom", chance: 18 }
		]
	}
];

const BF_DISTRIBUTION_RULES: readonly DistributionRule[] =
	createDistributionRules(BF_DISTRIBUTION_GROUPS);

/**
 * Low-level adapter for mutating procedural distribution tables.
 * Encapsulates the logic for safely appending items to a distribution table.
 */
class ProceduralDistributionRepository {
	/**
	 * @param list - The procedural distribution list from the game engine
	 */
	public constructor(private readonly list: ProceduralDistributionList) {}

	/**
	 * Appends an item and its spawn chance to a procedural distribution table.
	 * @param tableName - Name of the distribution table (e.g., "BathroomCabinet")
	 * @param itemType - Full item type ID (e.g., "BF.Condom")
	 * @param chance - Spawn chance weight
	 * @returns True if the item was appended; false if the table does not exist
	 */
	public appendItem(tableName: string, itemType: string, chance: number): boolean {
		const distribution = this.list[tableName];
		if (!distribution) {
			return false;
		}

		distribution.items.push(itemType, chance);
		return true;
	}
}

/**
 * High-level orchestrator for applying BF distribution rules to the game engine.
 * Iterates through all distribution rules and applies them to their target tables.
 */
class BFDistributionRegistrer {
	/**
	 * @param repository - Repository for table mutation
	 * @param rules - Distribution rules to apply
	 */
	public constructor(
		private readonly repository: ProceduralDistributionRepository,
		private readonly rules: readonly DistributionRule[]
	) {}

	/**
	 * Applies all distribution rules to their target procedural tables.
	 * @returns Number of successful table injections
	 */
	public apply(): number {
		let appliedEntries = 0;

		for (const rule of this.rules) {
			for (const tableName of rule.tableNames) {
				if (this.repository.appendItem(tableName, rule.itemType, rule.chance)) {
					appliedEntries += 1;
				}
			}
		}

		return appliedEntries;
	}
}

/**
 * Applies BF distribution rules to procedural loot tables in the game engine.
 * It is automatically invoked on module load.
 *
 * @param list - Optional distribution list to use; falls back to the global ProceduralDistributions
 * @returns Number of successful injections, or 0 if unavailable
 */
const applyBFDistributions = (
	list: ProceduralDistributionList = ProceduralDistributions.list
): number => {
	const repository = new ProceduralDistributionRepository(list);
	const registrer = new BFDistributionRegistrer(repository, BF_DISTRIBUTION_RULES);
	return registrer.apply();
};

try {
	applyBFDistributions();
} catch {
	// ProceduralDistributions not available during initialization
}

export { BF_DISTRIBUTION_RULES, applyBFDistributions };
