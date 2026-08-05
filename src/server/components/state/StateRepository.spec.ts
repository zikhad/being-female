import { ZLBF_STATE_MOD_DATA_KEY } from "@constants";
import { StateRepository } from "@server/components/state/StateRepository";
import { mockedPlayer } from "@test/mock";

describe("StateRepository", () => {
	it("seeds and normalizes state through property access", () => {
		const store: Record<string, unknown> = {};
		const player = mockedPlayer({ getModData: jest.fn().mockReturnValue(store) });

		const result = new StateRepository().load(player);

		if (!result.supported) throw new Error("expected supported state");
		expect(result.state).toEqual({ dataSchemaVersion: 1, stateVersion: 0, domains: {} });
		expect(store[ZLBF_STATE_MOD_DATA_KEY]).toBe(result.state);
	});

	it("reads and writes state through Kahlua get and set", () => {
		const persisted = { dataSchemaVersion: 1, stateVersion: 4, domains: {} };
		const get = jest.fn().mockReturnValue(persisted);
		const set = jest.fn();
		const player = mockedPlayer({ getModData: jest.fn().mockReturnValue({ get, set }) });

		const result = new StateRepository().load(player);

		if (!result.supported) throw new Error("expected supported state");
		expect(get).toHaveBeenCalledWith(ZLBF_STATE_MOD_DATA_KEY);
		expect(set).toHaveBeenCalledWith(ZLBF_STATE_MOD_DATA_KEY, result.state);
		expect(result.stateVersion).toBe(4);
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
		const state = { dataSchemaVersion: 1, stateVersion: 1, domains: {} };

		new StateRepository().save(player, state);

		expect(set).toHaveBeenCalledWith(ZLBF_STATE_MOD_DATA_KEY, state);
	});

	it("keeps different players isolated", () => {
		const firstStore: Record<string, unknown> = {
			[ZLBF_STATE_MOD_DATA_KEY]: { dataSchemaVersion: 1, stateVersion: 2, domains: {} }
		};
		const secondStore: Record<string, unknown> = {
			[ZLBF_STATE_MOD_DATA_KEY]: { dataSchemaVersion: 1, stateVersion: 8, domains: {} }
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
