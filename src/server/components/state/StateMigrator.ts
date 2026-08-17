import { ZLBF_DATA_SCHEMA_VERSION } from "@constants";
import {
	AuthoritativeState,
	StateLoadResult,
	SupportedStateLoadResult
} from "@server/components/state/AuthoritativeState";
import { nonNegativeInteger, positiveInteger, record } from "@shared/validation/Schema";
import { pregnancyStateSchema } from "@shared/domain/pregnancy/PregnancySchema";
import { PregnancyReconciler } from "@shared/domain/pregnancy/PregnancyReconciler";
import { birthStateSchema } from "@shared/domain/birth/BirthSchema";
import { createDefaultDomains } from "@shared/ZLBFState";
import { wombStateSchema } from "@shared/domain/womb/WombSchema";
import type { AuthoritativeWombState } from "@shared/domain/womb/WombState";
import { lactationStateSchema } from "@shared/domain/lactation/LactationSchema";

/** Normalizes persisted ZLBF state and protects future schemas from accidental downgrade. */
export class StateMigrator {
	/** Creates a migrator with the Pregnancy invariant policy used for persisted domains. */
	constructor(private readonly pregnancy = new PregnancyReconciler()) {}

	/** Creates a complete default authoritative root for a player without persisted state. */
	public createDefault(): AuthoritativeState {
		return {
			dataSchemaVersion: ZLBF_DATA_SCHEMA_VERSION,
			stateVersion: 0,
			domains: createDefaultDomains()
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
		if (record(persisted.domains) && pregnancyStateSchema(persisted.domains.pregnancy)) {
			const pregnancy = this.pregnancy.reconcile(
				state.domains.pregnancy,
				persisted.domains.pregnancy
			);
			if (pregnancy.valid) state.domains.pregnancy = pregnancy.state;
		}
		if (record(persisted.domains) && birthStateSchema(persisted.domains.birth)) {
			state.domains.birth = persisted.domains.birth;
		}
		if (record(persisted.domains) && wombStateSchema(persisted.domains.womb)) {
			const persistedWomb = persisted.domains.womb;
			const womb: AuthoritativeWombState = {};
			if (persistedWomb.cycleDay !== undefined) womb.cycleDay = persistedWomb.cycleDay;
			if (persistedWomb.amount !== undefined) womb.amount = persistedWomb.amount;
			if (persistedWomb.total !== undefined) womb.total = persistedWomb.total;
			if (persistedWomb.onContraceptive !== undefined)
				womb.onContraceptive = persistedWomb.onContraceptive;
			state.domains.womb = womb;
		}
		if (record(persisted.domains) && lactationStateSchema(persisted.domains.lactation)) {
			state.domains.lactation = persisted.domains.lactation;
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
