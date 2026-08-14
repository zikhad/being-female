import { ZLBF_DATA_SCHEMA_VERSION } from "@constants";
import { StateMigrator } from "@server/components/state/StateMigrator";
import { PregnancyStatus } from "@shared/domain/pregnancy/PregnancyState";
import { createDefaultBirthState } from "@shared/domain/birth/BirthState";
import { createDefaultDomains } from "@shared/ZLBFState";

describe("StateMigrator", () => {
	const migrator = new StateMigrator();

	it("creates a complete default state", () => {
		expect(migrator.createDefault()).toEqual({
			dataSchemaVersion: ZLBF_DATA_SCHEMA_VERSION,
			stateVersion: 0,
			domains: createDefaultDomains()
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
					domains: createDefaultDomains()
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
				state: {
					dataSchemaVersion: ZLBF_DATA_SCHEMA_VERSION,
					stateVersion: 7,
					domains: createDefaultDomains()
				}
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

	it("preserves a valid current Pregnancy domain", () => {
		const pregnancy = {
			status: PregnancyStatus.PREGNANT,
			current: 100,
			progress: 0.5,
			isInLabor: false
		};
		const result = migrator.migrate({
			dataSchemaVersion: ZLBF_DATA_SCHEMA_VERSION,
			stateVersion: 3,
			domains: { pregnancy, birth: createDefaultBirthState() }
		});

		expect(result.supported && result.state.domains.pregnancy).toEqual(pregnancy);
	});

	it("preserves a valid current Womb domain", () => {
		const result = migrator.migrate({
			dataSchemaVersion: ZLBF_DATA_SCHEMA_VERSION,
			stateVersion: 4,
			domains: { womb: { cycleDay: -7 } }
		});

		expect(result.supported && result.state.domains.womb).toEqual({ cycleDay: -7 });
	});
});
