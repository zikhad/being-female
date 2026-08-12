import type { AuthoritativeBirthState } from "@shared/domain/birth/BirthState";
import { createBabyData } from "@shared/domain/birth/BabyData";

/** Result of allocating or recovering a pending server-owned birth operation. */
export type BirthAllocation = {
	/** Whether allocating changed the persisted lifecycle state. */
	changed: boolean;
	/** Pending birth identity returned to the authenticated player. */
	birthId: string;
	/** Complete birth lifecycle state after allocation. */
	state: AuthoritativeBirthState;
};

/** Allocates deterministic, retry-safe birth identities for one authenticated player. */
export class BirthOperationAllocator {
	/**
	 * Returns an existing pending operation or allocates the player's next sequence.
	 *
	 * @param current Current server-authoritative birth lifecycle state.
	 * @param motherUsername Username derived from the authenticated server player.
	 * @returns Idempotent pending operation and the state that must be persisted.
	 */
	public allocate(current: AuthoritativeBirthState, motherUsername: string): BirthAllocation {
		if (current.pendingBirthId) {
			return { changed: false, birthId: current.pendingBirthId, state: current };
		}

		const birthSequence = current.birthSequence + 1;
		const birthId = createBabyData(motherUsername, birthSequence).birthId;
		return {
			changed: true,
			birthId,
			state: { ...current, birthSequence, pendingBirthId: birthId }
		};
	}
}
