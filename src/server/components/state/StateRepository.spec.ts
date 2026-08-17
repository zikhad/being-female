import { ZLBF_DATA_SCHEMA_VERSION, ZLBF_STATE_MOD_DATA_KEY } from "@constants";
import { StateRepository } from "@server/components/state/StateRepository";
import { mockedPlayer } from "@test/mock";
import { createDefaultDomains } from "@shared/ZLBFState";

const state = (stateVersion: number) => ({
	dataSchemaVersion: ZLBF_DATA_SCHEMA_VERSION,
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

	it("seeds a missing authoritative Lactation domain from validated legacy data", () => {
		const legacy = { isActive: true, milkAmount: 0.6, expiration: 8, multiplier: 0.3 };
		const persisted = state(4) as unknown as { domains: Record<string, unknown> };
		delete persisted.domains.lactation;
		const store = { [ZLBF_STATE_MOD_DATA_KEY]: persisted, ZLBFLactation: legacy };
		const player = mockedPlayer({ getModData: jest.fn().mockReturnValue(store) });

		const result = new StateRepository().load(player);

		expect(result.supported && result.state.domains.lactation).toEqual(legacy);
	});

	it("does not overwrite an unsupported future schema", () => {
		const persisted = { dataSchemaVersion: 9, stateVersion: 3, domains: { future: true } };
		const store = { [ZLBF_STATE_MOD_DATA_KEY]: persisted };
		const player = mockedPlayer({ getModData: jest.fn().mockReturnValue(store) });

		const result = new StateRepository().load(player);

		expect(result).toEqual({ supported: false, dataSchemaVersion: 9, stateVersion: 3 });
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
