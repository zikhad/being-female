import { BF_DISTRIBUTION_RULES, applyBFDistributions } from "@server/BFDistributions";

jest.mock("@asledgehammer/pipewrench");

type Entry = { items: unknown[] };

const getExpectedTableItems = (tableNames: readonly string[]) => {
	const expectedItemsByTable = new Map<string, unknown[]>();

	for (const tableName of tableNames) {
		expectedItemsByTable.set(tableName, []);
	}

	for (const rule of BF_DISTRIBUTION_RULES) {
		for (const tableName of rule.tableNames) {
			const expectedItems = expectedItemsByTable.get(tableName);
			if (!expectedItems) {
				continue;
			}

			expectedItems.push(rule.itemType, rule.chance);
		}
	}

	return expectedItemsByTable;
};

const createDistributionTable = (tableNames: readonly string[]) => {
	const list: Record<string, Entry> = {};

	for (const tableName of tableNames) {
		list[tableName] = { items: [] };
	}

	return list;
};

describe("BFDistributions.ts", () => {
	const expectedEntries = BF_DISTRIBUTION_RULES.reduce(
		(count, rule) => count + rule.tableNames.length,
		0
	);

	beforeEach(() => {
		Object.assign(globalThis, {
			ProceduralDistributions: { list: {} } as ProceduralDistributionRegistry
		});
	});
	it("injects item/chance pairs into existing procedural distributions", () => {
		const tableNames = Array.from(
			new Set(BF_DISTRIBUTION_RULES.flatMap(rule => [...rule.tableNames]))
		);
		const expectedItemsByTable = getExpectedTableItems(tableNames);
		const list = createDistributionTable(tableNames);

		const appliedEntries = applyBFDistributions(list);
		expect(appliedEntries).toBe(expectedEntries);

		for (const tableName of tableNames) {
			expect(list[tableName]?.items).toEqual(expectedItemsByTable.get(tableName));
		}
	});

	it("returns zero when procedural distributions are unavailable", () => {
		const appliedEntries = applyBFDistributions();
		expect(appliedEntries).toBe(0);
	});

	it("keeps reusable and multi-use BF supplies uncommon", () => {
		const chancesFor = (itemType: string) =>
			BF_DISTRIBUTION_RULES.filter(rule => rule.itemType === itemType).map(
				rule => rule.chance
			);

		expect(chancesFor("BF.Contraceptive")).toEqual([2, 1, 4, 4]);
		expect(chancesFor("BF.Lactaid")).toEqual([1, 0.5, 2, 2]);
		expect(chancesFor("BF.Condom")).toEqual([2, 4, 4, 2]);
		expect(chancesFor("BF.CondomBox")).toEqual([0.5, 0.5, 1, 2]);
		expect(chancesFor("BF.BreastPump")).toEqual([0.25, 1, 0.5]);
		expect(chancesFor("BF.VaginalDouche")).toEqual([0.5, 1, 1]);
		expect(chancesFor("BF.CondomUsed")).toEqual([1]);
	});

	it("uses appropriate retail tables and excludes child dressers and illicit drug locations", () => {
		const tablesFor = (itemType: string) =>
			BF_DISTRIBUTION_RULES.filter(rule => rule.itemType === itemType).flatMap(rule => [
				...rule.tableNames
			]);
		const allTables = BF_DISTRIBUTION_RULES.flatMap(rule => [...rule.tableNames]);

		expect(tablesFor("BF.Condom")).toContain("GigamartToiletries");
		expect(tablesFor("BF.Contraceptive")).toContain("StoreShelfMedical");
		expect(tablesFor("BF.BreastPump")).not.toContain("BedroomDresserChild");
		expect(allTables).not.toContain("GigamartHousewares");
		expect(allTables).not.toContain("DrugShackDrugs");
		expect(allTables).not.toContain("DerelictHouseDrugs");
	});
});
