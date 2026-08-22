import { getPlayer, sendClientCommand } from "@asledgehammer/pipewrench";
import {
	BF_NETWORK_MODULE,
	BF_PROTOCOL_SCHEMA_VERSION,
	BFNetworkCommand,
	BFSyncStatus
} from "@constants";
import { mockedPlayer } from "@test/mock";
import { SnapshotStore } from "@client/components/network/SnapshotStore";
import { SyncPublisher } from "@client/components/network/SyncPublisher";
import { createDefaultPregnancyState } from "@shared/domain/pregnancy/PregnancyState";
import { createDefaultDomains } from "@shared/BFState";

const snapshot = (schemaVersion: number, stateVersion: number) => ({
	schemaVersion,
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
			schemaVersion: BF_PROTOCOL_SCHEMA_VERSION,
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
			schemaVersion: BF_PROTOCOL_SCHEMA_VERSION,
			requestId,
			revision,
			status: BFSyncStatus.OK,
			data: { snapshot: snapshot(2, 4) }
		});

		publisher.onServerCommand(
			BF_NETWORK_MODULE,
			BFNetworkCommand.SYNC_STATE_RESPONSE,
			response("wrong", 1)
		);
		publisher.onServerCommand(
			BF_NETWORK_MODULE,
			BFNetworkCommand.SYNC_STATE_RESPONSE,
			response("snapshot-1", 2)
		);
		expect(snapshots.snapshot).toBeUndefined();

		publisher.onServerCommand(
			BF_NETWORK_MODULE,
			BFNetworkCommand.SYNC_STATE_RESPONSE,
			response("snapshot-1", 1)
		);
		expect(snapshots.snapshot).toEqual(snapshot(2, 4));

		publisher.onEveryOneMinute();
		expect(sendMock).toHaveBeenCalledTimes(1);
	});

	it("does not acknowledge malformed responses", () => {
		const publisher = new SyncPublisher(new SnapshotStore());
		publisher.onEveryOneMinute();
		publisher.onServerCommand(BF_NETWORK_MODULE, BFNetworkCommand.SYNC_STATE_RESPONSE, {
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

		publisher.onServerCommand(BF_NETWORK_MODULE, BFNetworkCommand.SYNC_STATE_RESPONSE, {
			schemaVersion: BF_PROTOCOL_SCHEMA_VERSION,
			requestId: "snapshot-1",
			revision: 1,
			status: BFSyncStatus.UNSUPPORTED_DATA_SCHEMA,
			data: { snapshot: snapshot(5, 9) }
		});

		expect(snapshots.snapshot).toBeUndefined();
		publisher.onEveryOneMinute();
		expect(sendMock).toHaveBeenCalledTimes(1);
	});

	it("bootstraps with fresh correlation on the minute after a session reset", () => {
		const publisher = new SyncPublisher(new SnapshotStore());
		publisher.onEveryOneMinute();
		publisher.resetSession();
		expect(sendMock).toHaveBeenCalledTimes(1);

		publisher.onEveryOneMinute();

		expect(sendMock).toHaveBeenCalledTimes(2);
		expect(sendMock.mock.calls[1][3]).toMatchObject({ requestId: "snapshot-2", revision: 2 });
	});
});
