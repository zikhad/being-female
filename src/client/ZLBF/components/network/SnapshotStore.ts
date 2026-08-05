import type { ZLBFSnapshot } from "@shared/ZLBFProtocol";

/**
 * Holds the latest validated server snapshot visible to client presentation code.
 * This store is a read-only mirror and does not persist or mutate gameplay state.
 */
export class SnapshotStore {
	private current?: ZLBFSnapshot;

	/** Returns the latest acknowledged server snapshot, if synchronization completed. */
	public get snapshot(): ZLBFSnapshot | undefined {
		return this.current;
	}

	/**
	 * Replaces the client mirror with a validated authoritative snapshot.
	 *
	 * @param snapshot Snapshot received in a correlated successful response.
	 */
	public apply(snapshot: ZLBFSnapshot): void {
		this.current = snapshot;
	}
}
