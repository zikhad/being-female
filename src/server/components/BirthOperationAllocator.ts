import type { AuthoritativeBirthState } from "@shared/domain/birth/BirthState";

/** Result of allocating or recovering a pending server-owned birth operation. */
export type BirthAllocation = {
	/** Whether allocating changed the persisted lifecycle state. */
	changed: boolean;
	/** Pending birth identity returned to the authenticated player. */
	birthId: string;
	/** Complete birth lifecycle state after allocation. */
	state: AuthoritativeBirthState;
};

/** Allocates deterministic, retry-safe birth identities for one server-owned character identity. */
export class BirthOperationAllocator {
	/**
	 * Returns an existing pending operation or allocates the player's next sequence.
	 *
	 * @param current Current server-authoritative birth lifecycle state.
	 * @param characterId Server-generated identity persisted for the authenticated character.
	 * @returns Idempotent pending operation and the state that must be persisted.
	 */
	public allocate(current: AuthoritativeBirthState, characterId: string): BirthAllocation {
		if (current.pendingBirthId) {
			return { changed: false, birthId: current.pendingBirthId, state: current };
		}

		const birthSequence = current.birthSequence + 1;
		const birthId = `${characterId}:birth:${birthSequence}`;
		return {
			changed: true,
			birthId,
			state: { ...current, birthSequence, pendingBirthId: birthId }
		};
	}
}
