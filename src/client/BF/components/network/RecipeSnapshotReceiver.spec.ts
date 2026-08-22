import { RecipeSnapshotReceiver } from "@client/components/network/RecipeSnapshotReceiver";
import { SnapshotStore } from "@client/components/network/SnapshotStore";
import {
	BF_STATE_SCHEMA_VERSION,
	BF_NETWORK_MODULE,
	BF_PROTOCOL_SCHEMA_VERSION,
	BFNetworkCommand,
	BFSyncStatus
} from "@constants";
import { createDefaultDomains } from "@shared/BFState";

describe("RecipeSnapshotReceiver", () => {
	it("applies a validated authoritative recipe acknowledgement", () => {
		const snapshots = new SnapshotStore();
		const receiver = new RecipeSnapshotReceiver(snapshots);
		const snapshot = {
			schemaVersion: BF_STATE_SCHEMA_VERSION,
			stateVersion: 2,
			domains: createDefaultDomains()
		};
		receiver.onServerCommand(BF_NETWORK_MODULE, BFNetworkCommand.RECIPE_STATE_RESPONSE, {
			schemaVersion: BF_PROTOCOL_SCHEMA_VERSION,
			requestId: "recipe-2",
			revision: 2,
			status: BFSyncStatus.OK,
			data: { snapshot }
		});
		expect(snapshots.snapshot).toEqual(snapshot);
	});
});
