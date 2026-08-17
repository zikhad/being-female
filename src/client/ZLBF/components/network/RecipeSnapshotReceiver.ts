import { ZLBF_NETWORK_MODULE, ZLBF_PROTOCOL_SCHEMA_VERSION, ZLBFNetworkCommand } from "@constants";
import { isZLBFSyncStateResponse } from "@shared/ZLBFProtocol";
import { SnapshotStore } from "@client/components/network/SnapshotStore";

/** Applies unsolicited authoritative snapshots emitted by server recipe callbacks. */
export class RecipeSnapshotReceiver {
	/** Creates a receiver backed by the common authoritative snapshot store. */
	constructor(private readonly snapshots: SnapshotStore) {}

	/** Accepts validated recipe acknowledgements and ignores unrelated server commands. */
	public onServerCommand(module: string, command: string, args: unknown): void {
		if (
			module !== ZLBF_NETWORK_MODULE ||
			command !== ZLBFNetworkCommand.RECIPE_STATE_RESPONSE ||
			!isZLBFSyncStateResponse(args) ||
			args.schemaVersion !== ZLBF_PROTOCOL_SCHEMA_VERSION
		)
			return;
		this.snapshots.apply(args.data.snapshot);
	}
}
