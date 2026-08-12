import { object, positiveInteger, string } from "@shared/validation/Schema";

/** Immutable ZLBF metadata attached to a baby item before inventory insertion. */
export type BabyData = {
	/** Version of the baby item metadata shape. */
	schemaVersion: number;
	/** Globally unique birth operation identity within one server. */
	birthId: string;
	/** Authenticated username captured when the server allocated the birth. */
	motherUsername: string;
	/** Persisted per-player sequence used to construct the birth identity. */
	birthSequence: number;
};

/** Runtime schema for baby item metadata read from untrusted item ModData. */
export const babyDataSchema = object<BabyData>({
	schemaVersion: positiveInteger,
	birthId: string({ minimumLength: 1, maximumLength: 128 }),
	motherUsername: string({ minimumLength: 1, maximumLength: 64 }),
	birthSequence: positiveInteger
});

/**
 * Creates immutable metadata for a server-allocated baby item.
 *
 * @param motherUsername Authenticated server username captured at birth.
 * @param birthSequence Persisted sequence allocated to this birth.
 * @returns Metadata to attach before the item enters an inventory.
 */
export const createBabyData = (motherUsername: string, birthSequence: number): BabyData => ({
	schemaVersion: 1,
	birthId: `${motherUsername}:birth:${birthSequence}`,
	motherUsername,
	birthSequence
});
