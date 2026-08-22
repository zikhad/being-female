import { ZLBF_STATE_SCHEMA_VERSION } from "@constants";
import { getRandomUUID } from "@asledgehammer/pipewrench";
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
import { characterIdSchema } from "@shared/domain/CharacterIdentity";

/** Produces a server-owned identity for one newly initialized character root. */
export type CharacterIdFactory = () => string;

/** Normalizes persisted ZLBF state and protects future schemas from accidental downgrade. */
export class StateMigrator {
	/** Creates a migrator with the Pregnancy invariant policy used for persisted domains. */
	constructor(
		private readonly pregnancy = new PregnancyReconciler(),
		private readonly createCharacterId: CharacterIdFactory = getRandomUUID
	) {}

	/** Creates a complete default authoritative root for a player without current valid state. */
	public createDefault(): AuthoritativeState {
		return {
			schemaVersion: ZLBF_STATE_SCHEMA_VERSION,
			characterId: this.createCharacterId(),
			stateVersion: 0,
			domains: createDefaultDomains()
		};
	}

	/**
	 * Converts an unknown persisted value into the current authoritative shape.
	 * Missing, older, and malformed roots reset fresh, while future roots remain untouched.
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
		if (persistedSchemaVersion !== ZLBF_STATE_SCHEMA_VERSION)
			return this.migrateOlder(persisted);
		if (!this.isCurrentState(persisted)) return this.supported(this.createDefault());
		return this.supported(this.canonicalize(persisted));
	}

	/**
	 * Dispatches migrations from released schemas older than the current schema.
	 *
	 * Add explicit, sequential migration steps here when a future release raises
	 * {@link ZLBF_STATE_SCHEMA_VERSION}. Each step must return a newly canonicalized root,
	 * preserve character identity, revision, and pending operations unless the migration
	 * explicitly documents otherwise, and never handle an unsupported future schema.
	 *
	 * @param persisted Older or unversioned root that cannot be loaded as the current schema.
	 * @returns Fresh state because the initial public schema has no released predecessor.
	 */
	private migrateOlder(persisted: Record<string, unknown>): SupportedStateLoadResult {
		// Add released migration steps to this dispatch, for example:
		switch (persisted.schemaVersion) {
			//     case 1:
			//         return this.migrateV1ToV2(persisted);
			default:
				return this.supported(this.createDefault());
		}
	}

	/** Validates the complete current root, including cross-field Pregnancy invariants. */
	private isCurrentState(value: Record<string, unknown>): value is AuthoritativeState {
		if (!characterIdSchema(value.characterId)) return false;
		return this.hasValidStateAndDomains(value);
	}

	/** Validates the revision and complete domain collection of a current root. */
	private hasValidStateAndDomains(value: Record<string, unknown>): boolean {
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
			characterId: state.characterId,
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
