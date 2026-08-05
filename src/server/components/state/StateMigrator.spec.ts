import { ZLBF_DATA_SCHEMA_VERSION } from "@constants";
import { StateMigrator } from "@server/components/state/StateMigrator";

describe("StateMigrator", () => {
	const migrator = new StateMigrator();

	it("creates a complete default state", () => {
		expect(migrator.createDefault()).toEqual({
			dataSchemaVersion: ZLBF_DATA_SCHEMA_VERSION,
			stateVersion: 0,
			domains: {}
		});
	});

	it.each([undefined, null, "invalid", Number.NaN])(
		"normalizes missing or malformed state %#",
		persisted => {
			expect(migrator.migrate(persisted)).toEqual({
				supported: true,
				dataSchemaVersion: ZLBF_DATA_SCHEMA_VERSION,
				stateVersion: 0,
				state: {
					dataSchemaVersion: ZLBF_DATA_SCHEMA_VERSION,
					stateVersion: 0,
					domains: {}
				}
			});
		}
	);

	it("preserves a valid state version while normalizing the root", () => {
		expect(
			migrator.migrate({ dataSchemaVersion: 1, stateVersion: 7, domains: undefined })
		).toEqual(
			expect.objectContaining({
				supported: true,
				stateVersion: 7,
				state: { dataSchemaVersion: 1, stateVersion: 7, domains: {} }
			})
		);
	});

	it("reports a future schema without downgrading its metadata", () => {
		expect(migrator.migrate({ dataSchemaVersion: 99, stateVersion: 12 })).toEqual({
			supported: false,
			dataSchemaVersion: 99,
			stateVersion: 12
		});
	});
});
