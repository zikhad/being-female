import { getPlayer, sendClientCommand } from "@asledgehammer/pipewrench";
import {
	ZLBF_NETWORK_MODULE,
	ZLBF_PROTOCOL_SCHEMA_VERSION,
	ZLBFNetworkCommand,
	ZLBFSyncStatus
} from "@constants";
import { mockedPlayer } from "@test/mock";
import { SnapshotStore } from "@client/components/network/SnapshotStore";
import { SyncPublisher } from "@client/components/network/SyncPublisher";
import { createDefaultPregnancyState } from "@shared/domain/pregnancy/PregnancyState";
import { createDefaultDomains } from "@shared/ZLBFState";

const snapshot = (dataSchemaVersion: number, stateVersion: number) => ({
	dataSchemaVersion,
	stateVersion,
	domains: createDefaultDomains()
});

jest.mock("@asledgehammer/pipewrench");

describe("SyncPublisher", () => {
	const sendMock = sendClientCommand as jest.MockedFunction<typeof sendClientCommand>;
	const getPlayerMock = getPlayer as jest.MockedFunction<typeof getPlayer>;

	beforeEach(() => {
		sendMock.mockReset();
		getPlayerMock.mockReset();
		getPlayerMock.mockReturnValue(mockedPlayer());
	});

	it("gets the available player and sends one correlated request on the first minute", () => {
		const publisher = new SyncPublisher(new SnapshotStore());
		expect(sendMock).not.toHaveBeenCalled();

		publisher.onEveryOneMinute();
		publisher.onEveryOneMinute();
		publisher.onEveryOneMinute();
		publisher.onEveryOneMinute();

		expect(sendMock).toHaveBeenCalledTimes(1);
		expect(getPlayerMock).toHaveBeenCalledTimes(1);
		const firstPayload = sendMock.mock.calls[0][3];
		expect(firstPayload).toEqual({
			schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
			requestId: "snapshot-1",
			revision: 1,
			data: {}
		});
	});

	it("acknowledges only an exactly correlated valid response", () => {
		const snapshots = new SnapshotStore();
		const publisher = new SyncPublisher(snapshots);
		publisher.onEveryOneMinute();
		const response = (requestId: string, revision: number) => ({
			schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
			requestId,
			revision,
			status: ZLBFSyncStatus.OK,
			data: { snapshot: snapshot(2, 4) }
		});

		publisher.onServerCommand(
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.SYNC_STATE_RESPONSE,
			response("wrong", 1)
		);
		publisher.onServerCommand(
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.SYNC_STATE_RESPONSE,
			response("snapshot-1", 2)
		);
		expect(snapshots.snapshot).toBeUndefined();

		publisher.onServerCommand(
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.SYNC_STATE_RESPONSE,
			response("snapshot-1", 1)
		);
		expect(snapshots.snapshot).toEqual(snapshot(2, 4));

		publisher.onEveryOneMinute();
		expect(sendMock).toHaveBeenCalledTimes(1);
	});

	it("does not acknowledge malformed responses", () => {
		const publisher = new SyncPublisher(new SnapshotStore());
		publisher.onEveryOneMinute();
		publisher.onServerCommand(ZLBF_NETWORK_MODULE, ZLBFNetworkCommand.SYNC_STATE_RESPONSE, {
			schemaVersion: 1,
			requestId: "snapshot-1",
			revision: Number.NaN,
			data: {}
		});
		publisher.onEveryOneMinute();
		expect(sendMock).toHaveBeenCalledTimes(1);
	});

	it("acknowledges an unsupported data schema without applying its snapshot", () => {
		const snapshots = new SnapshotStore();
		const publisher = new SyncPublisher(snapshots);
		publisher.onEveryOneMinute();

		publisher.onServerCommand(ZLBF_NETWORK_MODULE, ZLBFNetworkCommand.SYNC_STATE_RESPONSE, {
			schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
			requestId: "snapshot-1",
			revision: 1,
			status: ZLBFSyncStatus.UNSUPPORTED_DATA_SCHEMA,
			data: { snapshot: snapshot(5, 9) }
		});

		expect(snapshots.snapshot).toBeUndefined();
		publisher.onEveryOneMinute();
		expect(sendMock).toHaveBeenCalledTimes(1);
	});
});
