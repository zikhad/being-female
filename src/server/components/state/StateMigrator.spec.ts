import { ZLBF_STATE_SCHEMA_VERSION } from "@constants";
import { StateMigrator } from "@server/components/state/StateMigrator";
import { PregnancyStatus } from "@shared/domain/pregnancy/PregnancyState";
import { createDefaultDomains } from "@shared/ZLBFState";

describe("StateMigrator", () => {
	const createCharacterId = jest.fn(() => "character-current");
	const migrator = new StateMigrator(undefined, createCharacterId);
	const current = (stateVersion = 0) => ({
		schemaVersion: ZLBF_STATE_SCHEMA_VERSION,
		characterId: "character-current",
		stateVersion,
		domains: createDefaultDomains()
	});

	it("creates a complete default state", () => {
		expect(migrator.createDefault()).toEqual(current());
	});

	it("assigns different character identities to separate fresh roots", () => {
		const factory = jest
			.fn<ReturnType<() => string>, Parameters<() => string>>()
			.mockReturnValueOnce("character-one")
			.mockReturnValueOnce("character-two");
		const isolatedMigrator = new StateMigrator(undefined, factory);

		expect(isolatedMigrator.createDefault().characterId).toBe("character-one");
		expect(isolatedMigrator.createDefault().characterId).toBe("character-two");
		expect(factory).toHaveBeenCalledTimes(2);
	});

	it.each([undefined, null, "invalid", Number.NaN])(
		"resets a missing or malformed root %#",
		persisted => {
			expect(migrator.migrate(persisted)).toEqual({
				supported: true,
				schemaVersion: ZLBF_STATE_SCHEMA_VERSION,
				stateVersion: 0,
				state: current()
			});
		}
	);

	it.each([
		{ dataSchemaVersion: 5, stateVersion: 7, domains: createDefaultDomains() },
		{ schemaVersion: 0, stateVersion: 7, domains: createDefaultDomains() },
		{ schemaVersion: 1, stateVersion: 7, domains: undefined },
		{ schemaVersion: 1, stateVersion: 7, domains: { pregnancy: {} } },
		{ schemaVersion: 1, characterId: "", stateVersion: 7, domains: createDefaultDomains() }
	])("resets an old or incomplete root %#", persisted => {
		expect(migrator.migrate(persisted)).toEqual({
			supported: true,
			schemaVersion: ZLBF_STATE_SCHEMA_VERSION,
			stateVersion: 0,
			state: current()
		});
	});

	it("reports a future schema without downgrading its metadata", () => {
		expect(migrator.migrate({ schemaVersion: 99, stateVersion: 12 })).toEqual({
			supported: false,
			schemaVersion: 99,
			stateVersion: 12
		});
	});

	it("preserves a complete valid current root", () => {
		const persisted = current(5);
		persisted.domains.pregnancy = {
			status: PregnancyStatus.PREGNANT,
			current: 100,
			progress: 0.5,
			isInLabor: false
		};
		persisted.domains.womb = {
			cycleDay: -7,
			amount: 0.2,
			total: 1.4,
			onContraceptive: true
		};

		const result = migrator.migrate(persisted);

		expect(result.supported && result.state).toEqual(persisted);
		expect(result.supported && result.state).not.toBe(persisted);
	});

	it("strips unknown root and domain fields from a valid current state", () => {
		const persisted = current(3) as ReturnType<typeof current> & {
			future?: boolean;
		};
		persisted.future = true;
		(persisted.domains.womb as typeof persisted.domains.womb & { future?: boolean }).future =
			true;

		const result = migrator.migrate(persisted);

		expect(result.supported && result.state).toEqual(current(3));
	});

	it("resets a structurally valid root with inconsistent Pregnancy fields", () => {
		const persisted = current(5);
		persisted.domains.pregnancy = {
			status: PregnancyStatus.NOT_PREGNANT,
			current: 1,
			progress: 0,
			isInLabor: false
		};

		const result = migrator.migrate(persisted);

		expect(result.supported && result.state).toEqual(current());
	});
});
