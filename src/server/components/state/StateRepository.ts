import type { IsoPlayer } from "@asledgehammer/pipewrench";
import { ZLBF_STATE_MOD_DATA_KEY } from "@constants";
import { AuthoritativeState, StateLoadResult } from "@server/components/state/AuthoritativeState";
import { StateMigrator } from "@server/components/state/StateMigrator";
import { lactationStateSchema } from "@shared/domain/lactation/LactationSchema";
import { record } from "@shared/validation/Schema";

/** Kahlua-compatible access surface used by Project Zomboid ModData tables. */
type ModDataStore = Record<string, unknown> & {
	get?: (key: string) => unknown;
	set?: (key: string, value: unknown) => void;
};

/** Loads and normalizes the server-owned ZLBF root stored on an authenticated player. */
export class StateRepository {
	/** Creates a repository with the supplied persisted-data migration policy. */
	constructor(private readonly migrator = new StateMigrator()) {}

	/**
	 * Loads a player's authoritative state and rewrites supported data in normalized form.
	 * Unsupported future schemas are returned without modifying the stored value.
	 *
	 * @param player Authenticated server-side player whose state should be loaded.
	 * @returns Normalized state metadata and, when supported, the complete state root.
	 */
	public load(player: IsoPlayer): StateLoadResult {
		const store = player.getModData() as unknown as ModDataStore;
		const persisted = this.getValue(store);
		const result = this.migrator.migrate(persisted);

		if (result.supported) {
			const persistedHasLactation =
				record(persisted) &&
				record(persisted.domains) &&
				lactationStateSchema(persisted.domains.lactation);
			const legacy = this.getStoreValue(store, "ZLBFLactation");
			if (!persistedHasLactation && lactationStateSchema(legacy)) {
				result.state.domains.lactation = legacy;
			}
			this.setValue(store, result.state);
		}

		const source = persisted === undefined ? "initialized" : "loaded";
		print(
			`[ZLBF][MP][Server] authoritative state ${source} schema=${result.dataSchemaVersion} state=${result.stateVersion}`
		);

		return result;
	}

	/**
	 * Writes a complete authoritative root to the authenticated server player.
	 * Domain handlers should call this only after a successful validated transition.
	 *
	 * @param player Authenticated server-side player whose state should be persisted.
	 * @param state Complete current-schema authoritative root.
	 */
	public save(player: IsoPlayer, state: AuthoritativeState): void {
		const store = player.getModData() as unknown as ModDataStore;
		this.setValue(store, state);
	}

	/** Reads the namespaced state through Kahlua or property access. */
	private getValue(store: ModDataStore): unknown {
		return this.getStoreValue(store, ZLBF_STATE_MOD_DATA_KEY);
	}

	/** Reads one ModData value through Kahlua or property access. */
	private getStoreValue(store: ModDataStore, key: string): unknown {
		if (typeof store.get === "function") return store.get(key);
		return store[key];
	}

	/** Writes the complete namespaced state through Kahlua or property access. */
	private setValue(store: ModDataStore, value: unknown): void {
		if (typeof store.set === "function") {
			store.set(ZLBF_STATE_MOD_DATA_KEY, value);
			return;
		}

		store[ZLBF_STATE_MOD_DATA_KEY] = value;
	}
}
