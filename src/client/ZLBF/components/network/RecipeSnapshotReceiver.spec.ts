import { RecipeSnapshotReceiver } from "@client/components/network/RecipeSnapshotReceiver";
import { SnapshotStore } from "@client/components/network/SnapshotStore";
import {
	ZLBF_DATA_SCHEMA_VERSION,
	ZLBF_NETWORK_MODULE,
	ZLBF_PROTOCOL_SCHEMA_VERSION,
	ZLBFNetworkCommand,
	ZLBFSyncStatus
} from "@constants";
import { createDefaultDomains } from "@shared/ZLBFState";

describe("RecipeSnapshotReceiver", () => {
	it("applies a validated authoritative recipe acknowledgement", () => {
		const snapshots = new SnapshotStore();
		const receiver = new RecipeSnapshotReceiver(snapshots);
		const snapshot = {
			dataSchemaVersion: ZLBF_DATA_SCHEMA_VERSION,
			stateVersion: 2,
			domains: createDefaultDomains()
		};
		receiver.onServerCommand(ZLBF_NETWORK_MODULE, ZLBFNetworkCommand.RECIPE_STATE_RESPONSE, {
			schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
			requestId: "recipe-2",
			revision: 2,
			status: ZLBFSyncStatus.OK,
			data: { snapshot }
		});
		expect(snapshots.snapshot).toEqual(snapshot);
	});
});
