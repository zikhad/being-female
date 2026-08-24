import { BF_NETWORK_MODULE, BF_PROTOCOL_SCHEMA_VERSION, BFNetworkCommand } from "@constants";
import { isBFSyncStateResponse } from "@shared/BFProtocol";
import { SnapshotStore } from "@client/components/network/SnapshotStore";

/** Applies unsolicited authoritative snapshots emitted by server recipe callbacks. */
export class RecipeSnapshotReceiver {
	/** Creates a receiver backed by the common authoritative snapshot store. */
	constructor(private readonly snapshots: SnapshotStore) {}

	/** Accepts validated recipe acknowledgements and ignores unrelated server commands. */
	public onServerCommand(module: string, command: string, args: unknown): void {
		if (
			module !== BF_NETWORK_MODULE ||
			command !== BFNetworkCommand.RECIPE_STATE_RESPONSE ||
			!isBFSyncStateResponse(args) ||
			args.schemaVersion !== BF_PROTOCOL_SCHEMA_VERSION
		)
			return;
		this.snapshots.apply(args.data.snapshot);
	}
}
