import { ZLBF_DATA_SCHEMA_VERSION } from "@constants";
import {
	AuthoritativeState,
	StateLoadResult,
	SupportedStateLoadResult
} from "@server/components/state/AuthoritativeState";
import { nonNegativeInteger, positiveInteger, record } from "@shared/validation/Schema";

/** Normalizes persisted ZLBF state and protects future schemas from accidental downgrade. */
export class StateMigrator {
	/** Creates a complete default authoritative root for a player without persisted state. */
	public createDefault(): AuthoritativeState {
		return {
			dataSchemaVersion: ZLBF_DATA_SCHEMA_VERSION,
			stateVersion: 0,
			domains: {}
		};
	}

	/**
	 * Converts an unknown persisted value into the current authoritative shape.
	 * Future schema versions are reported but never rewritten by this mod version.
	 *
	 * @param persisted Raw value read from player ModData.
	 * @returns Supported normalized state or metadata for an unsupported future schema.
	 */
	public migrate(persisted: unknown): StateLoadResult {
		if (!record(persisted)) return this.supported(this.createDefault());

		const persistedSchemaVersion = persisted.dataSchemaVersion;
		if (
			positiveInteger(persistedSchemaVersion) &&
			persistedSchemaVersion > ZLBF_DATA_SCHEMA_VERSION
		) {
			return {
				supported: false,
				dataSchemaVersion: persistedSchemaVersion,
				stateVersion: nonNegativeInteger(persisted.stateVersion)
					? persisted.stateVersion
					: 0
			};
		}

		const state = this.createDefault();
		if (nonNegativeInteger(persisted.stateVersion)) {
			state.stateVersion = persisted.stateVersion;
		}

		return this.supported(state);
	}

	/** Builds the successful load result returned for a normalized state. */
	private supported(state: AuthoritativeState): SupportedStateLoadResult {
		return {
			supported: true,
			dataSchemaVersion: state.dataSchemaVersion,
			stateVersion: state.stateVersion,
			state
		};
	}
}
