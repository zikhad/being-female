import { string } from "@shared/validation/Schema";

/** Maximum persisted character-identity length accepted from stored or item ModData. */
export const CHARACTER_ID_MAXIMUM_LENGTH = 64;

/** Validates a bounded, non-empty server-generated character identity. */
export const characterIdSchema = string({
	minimumLength: 1,
	maximumLength: CHARACTER_ID_MAXIMUM_LENGTH
});
