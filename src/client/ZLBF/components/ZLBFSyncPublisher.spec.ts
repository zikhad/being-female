import { sendClientCommand } from "@asledgehammer/pipewrench";
import {
	ZLBF_NETWORK_MODULE,
	ZLBF_PROTOCOL_SCHEMA_VERSION,
	ZLBFNetworkCommand,
	ZLBFSyncStatus
} from "@constants";
import { mockedPlayer } from "@test/mock";
import { ZLBFSnapshotStore } from "@client/components/ZLBFSnapshotStore";
import { ZLBFSyncPublisher } from "@client/components/ZLBFSyncPublisher";

jest.mock("@asledgehammer/pipewrench");

describe("ZLBFSyncPublisher", () => {
	const sendMock = sendClientCommand as jest.MockedFunction<typeof sendClientCommand>;

	beforeEach(() => sendMock.mockReset());

	it("binds without sending, then retries the same correlated request three times", () => {
		const publisher = new ZLBFSyncPublisher(new ZLBFSnapshotStore());
		const player = mockedPlayer();
		publisher.bindPlayer(player);
		expect(sendMock).not.toHaveBeenCalled();

		publisher.onEveryOneMinute();
		publisher.onEveryOneMinute();
		publisher.onEveryOneMinute();
		publisher.onEveryOneMinute();

		expect(sendMock).toHaveBeenCalledTimes(3);
		const firstPayload = sendMock.mock.calls[0][3];
		expect(firstPayload).toEqual({
			schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
			requestId: "snapshot-1",
			revision: 1,
			data: {}
		});
		expect(sendMock.mock.calls[1][3]).toEqual(firstPayload);
		expect(sendMock.mock.calls[2][3]).toEqual(firstPayload);
	});

	it("acknowledges only an exactly correlated valid response", () => {
		const snapshots = new ZLBFSnapshotStore();
		const publisher = new ZLBFSyncPublisher(snapshots);
		publisher.bindPlayer(mockedPlayer());
		publisher.onEveryOneMinute();
		const response = (requestId: string, revision: number) => ({
			schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
			requestId,
			revision,
			status: ZLBFSyncStatus.OK,
			data: { snapshot: { dataSchemaVersion: 1, stateVersion: 4 } }
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
		expect(snapshots.snapshot).toEqual({ dataSchemaVersion: 1, stateVersion: 4 });

		publisher.onEveryOneMinute();
		expect(sendMock).toHaveBeenCalledTimes(1);

		publisher.bindPlayer(mockedPlayer());
		expect(snapshots.snapshot).toBeUndefined();
	});

	it("does not acknowledge malformed responses", () => {
		const publisher = new ZLBFSyncPublisher(new ZLBFSnapshotStore());
		publisher.bindPlayer(mockedPlayer());
		publisher.onEveryOneMinute();
		publisher.onServerCommand(ZLBF_NETWORK_MODULE, ZLBFNetworkCommand.SYNC_STATE_RESPONSE, {
			schemaVersion: 1,
			requestId: "snapshot-1",
			revision: Number.NaN,
			data: {}
		});
		publisher.onEveryOneMinute();
		expect(sendMock).toHaveBeenCalledTimes(2);
	});
});
