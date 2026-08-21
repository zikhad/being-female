import { ZLBF_STATE_SCHEMA_VERSION } from "@constants";
import {
	AuthoritativeState,
	StateLoadResult,
	SupportedStateLoadResult
} from "@server/components/state/AuthoritativeState";
import { birthStateSchema } from "@shared/domain/birth/BirthSchema";
import { lactationStateSchema } from "@shared/domain/lactation/LactationSchema";
import { pregnancyStateSchema } from "@shared/domain/pregnancy/PregnancySchema";
import { PregnancyReconciler } from "@shared/domain/pregnancy/PregnancyReconciler";
import { wombStateSchema } from "@shared/domain/womb/WombSchema";
import { createDefaultDomains } from "@shared/ZLBFState";
import { nonNegativeInteger, positiveInteger, record } from "@shared/validation/Schema";

/** Normalizes persisted ZLBF state and protects future schemas from accidental downgrade. */
export class StateMigrator {
	/** Creates a migrator with the Pregnancy invariant policy used for persisted domains. */
	constructor(private readonly pregnancy = new PregnancyReconciler()) {}

	/** Creates a complete default authoritative root for a player without current valid state. */
	public createDefault(): AuthoritativeState {
		return {
			schemaVersion: ZLBF_STATE_SCHEMA_VERSION,
			stateVersion: 0,
			domains: createDefaultDomains()
		};
	}

	/**
	 * Converts an unknown persisted value into the current authoritative shape.
	 * Missing, old, and malformed roots reset fresh. Future roots remain untouched.
	 *
	 * @param persisted Raw value read from player ModData.
	 * @returns Supported current state or metadata for an unsupported future schema.
	 */
	public migrate(persisted: unknown): StateLoadResult {
		if (!record(persisted)) return this.supported(this.createDefault());
		const persistedSchemaVersion = persisted.schemaVersion;
		if (
			positiveInteger(persistedSchemaVersion) &&
			persistedSchemaVersion > ZLBF_STATE_SCHEMA_VERSION
		) {
			return {
				supported: false,
				schemaVersion: persistedSchemaVersion,
				stateVersion: nonNegativeInteger(persisted.stateVersion)
					? persisted.stateVersion
					: 0
			};
		}
		if (persistedSchemaVersion !== ZLBF_STATE_SCHEMA_VERSION) {
			return this.migrateOlder(persistedSchemaVersion, persisted);
		}
		if (!this.isCurrentState(persisted)) return this.supported(this.createDefault());
		return this.supported(this.canonicalize(persisted));
	}

	/**
	 * Dispatches supported historical schemas to explicit future migrations.
	 * The clean unpublished schema has no predecessors, so every older root resets fresh.
	 *
	 * @param schemaVersion Historical schema marker read from the persisted root.
	 * @param persisted Historical root reserved for a future version-specific migrator.
	 * @returns A fresh current-schema state until a declared migration is introduced.
	 */
	private migrateOlder(
		schemaVersion: unknown,
		persisted: Record<string, unknown>
	): StateLoadResult {
		void schemaVersion;
		void persisted;
		return this.supported(this.createDefault());
	}

	/** Validates the complete current root, including cross-field Pregnancy invariants. */
	private isCurrentState(value: Record<string, unknown>): value is AuthoritativeState {
		if (!nonNegativeInteger(value.stateVersion) || !record(value.domains)) return false;
		const domains = value.domains;
		if (
			!pregnancyStateSchema(domains.pregnancy) ||
			!birthStateSchema(domains.birth) ||
			!wombStateSchema(domains.womb) ||
			!lactationStateSchema(domains.lactation)
		) {
			return false;
		}
		return this.pregnancy.isConsistent(domains.pregnancy);
	}

	/** Rebuilds a validated root from declared fields so unknown table keys are not persisted. */
	private canonicalize(state: AuthoritativeState): AuthoritativeState {
		const birth = state.domains.birth;
		const pregnancy = state.domains.pregnancy;
		const womb = state.domains.womb;
		const lactation = state.domains.lactation;
		return {
			schemaVersion: ZLBF_STATE_SCHEMA_VERSION,
			stateVersion: state.stateVersion,
			domains: {
				pregnancy: {
					status: pregnancy.status,
					current: pregnancy.current,
					progress: pregnancy.progress,
					isInLabor: pregnancy.isInLabor
				},
				birth: {
					birthSequence: birth.birthSequence,
					...(birth.pendingBirthId !== undefined
						? { pendingBirthId: birth.pendingBirthId }
						: {}),
					...(birth.completedBirthId !== undefined
						? { completedBirthId: birth.completedBirthId }
						: {})
				},
				womb: {
					cycleDay: womb.cycleDay,
					amount: womb.amount,
					total: womb.total,
					onContraceptive: womb.onContraceptive
				},
				lactation: {
					isActive: lactation.isActive,
					milkAmount: lactation.milkAmount,
					expiration: lactation.expiration,
					multiplier: lactation.multiplier
				}
			}
		};
	}

	/** Builds the successful load result returned for a validated current state. */
	private supported(state: AuthoritativeState): SupportedStateLoadResult {
		return {
			supported: true,
			schemaVersion: state.schemaVersion,
			stateVersion: state.stateVersion,
			state
		};
	}
}
