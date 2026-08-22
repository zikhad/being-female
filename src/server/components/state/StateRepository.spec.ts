import { ZLBF_STATE_SCHEMA_VERSION, ZLBF_STATE_MOD_DATA_KEY } from "@constants";
import { StateRepository } from "@server/components/state/StateRepository";
import { mockedPlayer } from "@test/mock";
import { createDefaultDomains } from "@shared/ZLBFState";
import { StateMigrator } from "@server/components/state/StateMigrator";

const state = (stateVersion: number) => ({
	schemaVersion: ZLBF_STATE_SCHEMA_VERSION,
	characterId: "test-character-id",
	stateVersion,
	domains: createDefaultDomains()
});

describe("StateRepository", () => {
	it("seeds and normalizes state through property access", () => {
		const store: Record<string, unknown> = {};
		const player = mockedPlayer({ getModData: jest.fn().mockReturnValue(store) });

		const result = new StateRepository().load(player);

		if (!result.supported) throw new Error("expected supported state");
		expect(result.state).toEqual(state(0));
		expect(store[ZLBF_STATE_MOD_DATA_KEY]).toBe(result.state);
	});

	it("reads and writes state through Kahlua get and set", () => {
		const persisted = state(4);
		const get = jest.fn().mockReturnValue(persisted);
		const set = jest.fn();
		const player = mockedPlayer({ getModData: jest.fn().mockReturnValue({ get, set }) });

		const result = new StateRepository().load(player);

		if (!result.supported) throw new Error("expected supported state");
		expect(get).toHaveBeenCalledWith(ZLBF_STATE_MOD_DATA_KEY);
		expect(set).toHaveBeenCalledWith(ZLBF_STATE_MOD_DATA_KEY, result.state);
		expect(result.stateVersion).toBe(4);
	});

	it("persists a v1 migration once and reuses its character identity on later loads", () => {
		const createCharacterId = jest.fn(() => "migrated-character-id");
		const repository = new StateRepository(new StateMigrator(undefined, createCharacterId));
		const store: Record<string, unknown> = {
			[ZLBF_STATE_MOD_DATA_KEY]: {
				schemaVersion: 1,
				stateVersion: 7,
				domains: createDefaultDomains()
			}
		};
		const player = mockedPlayer({ getModData: jest.fn().mockReturnValue(store) });

		const first = repository.load(player);
		const second = repository.load(player);

		if (!first.supported || !second.supported) throw new Error("expected supported states");
		expect(first.state.characterId).toBe("migrated-character-id");
		expect(first.state.schemaVersion).toBe(2);
		expect(first.state.stateVersion).toBe(7);
		expect(second.state.characterId).toBe("migrated-character-id");
		expect(createCharacterId).toHaveBeenCalledTimes(1);
	});

	it("does not import local Lactation when the authoritative root is incomplete", () => {
		const local = { isActive: true, milkAmount: 0.6, expiration: 8, multiplier: 0.3 };
		const persisted = state(4) as unknown as { domains: Record<string, unknown> };
		delete persisted.domains.lactation;
		const store = { [ZLBF_STATE_MOD_DATA_KEY]: persisted, ZLBFLactation: local };
		const player = mockedPlayer({ getModData: jest.fn().mockReturnValue(store) });

		const result = new StateRepository().load(player);

		expect(result.supported && result.state.domains.lactation).toEqual(
			createDefaultDomains().lactation
		);
	});

	it("does not overwrite an unsupported future schema", () => {
		const persisted = { schemaVersion: 9, stateVersion: 3, domains: { future: true } };
		const store = { [ZLBF_STATE_MOD_DATA_KEY]: persisted };
		const player = mockedPlayer({ getModData: jest.fn().mockReturnValue(store) });

		const result = new StateRepository().load(player);

		expect(result).toEqual({ supported: false, schemaVersion: 9, stateVersion: 3 });
		expect(store[ZLBF_STATE_MOD_DATA_KEY]).toBe(persisted);
	});

	it("explicitly saves a complete authoritative root", () => {
		const set = jest.fn();
		const player = mockedPlayer({
			getModData: jest.fn().mockReturnValue({ get: jest.fn(), set })
		});
		const authoritative = state(1);

		new StateRepository().save(player, authoritative);

		expect(set).toHaveBeenCalledWith(ZLBF_STATE_MOD_DATA_KEY, authoritative);
	});

	it("keeps different players isolated", () => {
		const firstStore: Record<string, unknown> = {
			[ZLBF_STATE_MOD_DATA_KEY]: state(2)
		};
		const secondStore: Record<string, unknown> = {
			[ZLBF_STATE_MOD_DATA_KEY]: state(8)
		};
		const repository = new StateRepository();

		const first = repository.load(
			mockedPlayer({ getModData: jest.fn().mockReturnValue(firstStore) })
		);
		const second = repository.load(
			mockedPlayer({ getModData: jest.fn().mockReturnValue(secondStore) })
		);

		if (!first.supported || !second.supported) throw new Error("expected supported states");
		expect(first.stateVersion).toBe(2);
		expect(second.stateVersion).toBe(8);
		expect(first.state).not.toBe(second.state);
	});
});
