import type { ZLBFSnapshot } from "@shared/ZLBFProtocol";

/** Listener notified whenever a validated authoritative snapshot replaces the mirror. */
export type SnapshotListener = (snapshot: ZLBFSnapshot) => void;

/**
 * Holds the latest validated server snapshot visible to client presentation code.
 * This store is a read-only mirror and does not persist or mutate gameplay state.
 */
export class SnapshotStore {
	private current?: ZLBFSnapshot;
	private readonly listeners: SnapshotListener[] = [];

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
		if (this.current && snapshot.stateVersion <= this.current.stateVersion) return;
		this.current = snapshot;
		for (const listener of this.listeners) listener(snapshot);
	}

	/** Re-notifies listeners of the retained current snapshot after optimism drains. */
	public notifyCurrent(): void {
		if (!this.current) return;
		for (const listener of this.listeners) listener(this.current);
	}

	/** Clears connection-scoped authoritative state without removing long-lived listeners. */
	public resetSession(): void {
		this.current = undefined;
	}

	/**
	 * Registers a listener for future authoritative snapshot replacements.
	 *
	 * @param listener Callback invoked after the mirror is updated.
	 */
	public subscribe(listener: SnapshotListener): void {
		this.listeners.push(listener);
	}
}
