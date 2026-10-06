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
});
