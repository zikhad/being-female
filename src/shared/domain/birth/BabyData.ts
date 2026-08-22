import { object, oneOf, positiveInteger, string } from "@shared/validation/Schema";
import type { PlayerIdentity } from "@shared/components/Player";
import { characterIdSchema } from "@shared/domain/CharacterIdentity";

/** Immutable BF metadata attached to a baby item before inventory insertion. */
export type BabyData = {
	/** Version of the baby item metadata shape. */
	schemaVersion: number;
	/** Globally unique birth operation identity within one server. */
	birthId: string;
	/** Server-generated identity of the character who gave birth. */
	motherCharacterId: string;
	/** Authenticated username captured when the server allocated the birth. */
	motherUsername: string;
	/** Character name captured once when the birth completes. */
	motherName: string;
	/** Persisted per-player sequence used to construct the birth identity. */
	birthSequence: number;
};

/** Server-owned inputs captured when completing one allocated birth operation. */
export type CreateBabyDataInput = {
	/** Exact server-allocated operation identity received in the completion request. */
	birthId: string;
	/** Server-generated identity persisted for the mother character. */
	motherCharacterId: string;
	/** Authenticated account and character names captured as descriptive metadata. */
	mother: PlayerIdentity;
	/** Persisted sequence associated with the allocated operation. */
	birthSequence: number;
};

/** Runtime schema for baby item metadata read from untrusted item ModData. */
export const babyDataSchema = object<BabyData>({
	schemaVersion: oneOf([1]),
	birthId: string({ minimumLength: 1, maximumLength: 128 }),
	motherCharacterId: characterIdSchema,
	motherUsername: string({ minimumLength: 1, maximumLength: 64 }),
	motherName: string({ minimumLength: 1, maximumLength: 128 }),
	birthSequence: positiveInteger
});

/**
 * Creates immutable metadata for a server-allocated baby item.
 *
 * @param input Named server-owned operation and mother identity captured at birth.
 * @returns Metadata to attach before the item enters an inventory.
 */
export const createBabyData = (input: CreateBabyDataInput): BabyData => ({
	schemaVersion: 1,
	birthId: input.birthId,
	motherCharacterId: input.motherCharacterId,
	motherUsername: input.mother.username,
	motherName: input.mother.name,
	birthSequence: input.birthSequence
});
