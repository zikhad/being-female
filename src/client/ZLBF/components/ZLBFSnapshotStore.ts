import type { ZLBFSnapshot } from "@shared/ZLBFProtocol";

export class ZLBFSnapshotStore {
	private current?: ZLBFSnapshot;

	public get snapshot(): ZLBFSnapshot | undefined {
		return this.current;
	}

	public apply(snapshot: ZLBFSnapshot): void {
		this.current = snapshot;
	}

	public clear(): void {
		this.current = undefined;
	}
}
