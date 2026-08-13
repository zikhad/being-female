import { object, positiveInteger, string } from "@shared/validation/Schema";
import type { PlayerIdentity } from "@shared/components/Player";

/** Immutable ZLBF metadata attached to a baby item before inventory insertion. */
export type BabyData = {
	/** Version of the baby item metadata shape. */
	schemaVersion: number;
	/** Globally unique birth operation identity within one server. */
	birthId: string;
	/** Authenticated username captured when the server allocated the birth. */
	motherUsername: string;
	/** Character name captured once when the birth completes. */
	motherName: string;
	/** Persisted per-player sequence used to construct the birth identity. */
	birthSequence: number;
};

/** Runtime schema for baby item metadata read from untrusted item ModData. */
export const babyDataSchema = object<BabyData>({
	schemaVersion: positiveInteger,
	birthId: string({ minimumLength: 1, maximumLength: 128 }),
	motherUsername: string({ minimumLength: 1, maximumLength: 64 }),
	motherName: string({ minimumLength: 1, maximumLength: 128 }),
	birthSequence: positiveInteger
});

/**
 * Creates immutable metadata for a server-allocated baby item.
 *
 * @param mother Validated account and character identity captured at birth.
 * @param birthSequence Persisted sequence allocated to this birth.
 * @returns Metadata to attach before the item enters an inventory.
 */
export const createBabyData = (mother: PlayerIdentity, birthSequence: number): BabyData => ({
	schemaVersion: 1,
	birthId: `${mother.username}:birth:${birthSequence}`,
	motherUsername: mother.username,
	motherName: mother.name,
	birthSequence
});
