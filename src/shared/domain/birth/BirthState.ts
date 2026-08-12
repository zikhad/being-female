/** Persisted server-owned lifecycle state for exact-once birth operations. */
export type AuthoritativeBirthState = {
	/** Last sequence allocated for this player; zero means no birth has been allocated. */
	birthSequence: number;
	/** Operation currently awaiting client presentation and completion. */
	pendingBirthId?: string;
	/** Most recently completed operation, retained to make retries idempotent. */
	completedBirthId?: string;
};

/** Creates the default birth lifecycle state for a player without prior operations. */
export const createDefaultBirthState = (): AuthoritativeBirthState => ({
	birthSequence: 0
});
