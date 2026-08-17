import { getPlayer, sendClientCommand } from "@asledgehammer/pipewrench";
import { WombPublisher } from "@client/components/network/WombPublisher";
import { SnapshotStore } from "@client/components/network/SnapshotStore";
import {
	ZLBF_NETWORK_MODULE,
	ZLBF_PROTOCOL_SCHEMA_VERSION,
	ZLBFNetworkCommand,
	ZLBFSyncStatus
} from "@constants";
import { createDefaultDomains } from "@shared/ZLBFState";

jest.mock("@asledgehammer/pipewrench");

describe("WombPublisher", () => {
	const sendMock = sendClientCommand as jest.MockedFunction<typeof sendClientCommand>;
	const state = (cycleDay: number) => ({
		cycleDay,
		amount: 0.2,
		total: 0.4
	});

	beforeEach(() => sendMock.mockReset());

	it("publishes concrete reversible Womb state", () => {
		new WombPublisher(new SnapshotStore()).publishState(state(-6));
		expect(sendMock).toHaveBeenCalledWith(
			getPlayer(),
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.PUBLISH_WOMB_STATE_REQUEST,
			expect.objectContaining({ data: { desired: state(-6) } })
		);
	});

	it("applies a correlated authoritative response", () => {
		const snapshots = new SnapshotStore();
		const publisher = new WombPublisher(snapshots);
		publisher.publishState(state(-6));
		const snapshot = {
			dataSchemaVersion: 4,
			stateVersion: 2,
			domains: { ...createDefaultDomains(), womb: { cycleDay: -6 } }
		};
		publisher.onServerCommand(
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.PUBLISH_WOMB_STATE_RESPONSE,
			{
				schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
				requestId: "womb-1",
				revision: 1,
				status: ZLBFSyncStatus.OK,
				data: { snapshot }
			}
		);
		expect(snapshots.snapshot).toEqual(snapshot);
	});

	it("coalesces daily progression and sends the latest state after acknowledgement", () => {
		const publisher = new WombPublisher(new SnapshotStore());
		publisher.publishState(state(-6));
		publisher.publishState(state(-5));
		publisher.publishState(state(-4));

		publisher.onServerCommand(
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.PUBLISH_WOMB_STATE_RESPONSE,
			{
				schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
				requestId: "womb-1",
				revision: 1,
				status: ZLBFSyncStatus.OK,
				data: {
					snapshot: {
						dataSchemaVersion: 4,
						stateVersion: 2,
						domains: { ...createDefaultDomains(), womb: { cycleDay: -6 } }
					}
				}
			}
		);

		expect(sendMock).toHaveBeenCalledTimes(2);
		expect(sendMock).toHaveBeenLastCalledWith(
			getPlayer(),
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.PUBLISH_WOMB_STATE_REQUEST,
			expect.objectContaining({ data: { desired: state(-4) } })
		);
	});

	it("drops same-day queued contraceptive clearing when authoritative state is already true", () => {
		const snapshots = new SnapshotStore();
		snapshots.apply({ dataSchemaVersion: 5, stateVersion: 3, domains: createDefaultDomains() });
		const publisher = new WombPublisher(snapshots);
		publisher.publishState({ ...state(1), onContraceptive: false });
		publisher.publishState({ ...state(1), onContraceptive: false });
		publisher.onServerCommand(
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.PUBLISH_WOMB_STATE_RESPONSE,
			{
				schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
				requestId: "womb-1",
				revision: 1,
				status: ZLBFSyncStatus.OK,
				data: {
					snapshot: {
						dataSchemaVersion: 5,
						stateVersion: 4,
						domains: {
							...createDefaultDomains(),
							womb: { ...state(1), onContraceptive: true }
						}
					}
				}
			}
		);

		expect(sendMock).toHaveBeenCalledTimes(1);
		expect(snapshots.snapshot?.domains.womb.onContraceptive).toBe(true);
	});

	it("rebases and retries a rejected pending day change without a queued update", () => {
		const snapshots = new SnapshotStore();
		snapshots.apply({
			dataSchemaVersion: 5,
			stateVersion: 3,
			domains: { ...createDefaultDomains(), womb: state(1) }
		});
		const publisher = new WombPublisher(snapshots);
		publisher.publishState(state(2));

		publisher.onServerCommand(
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.PUBLISH_WOMB_STATE_RESPONSE,
			{
				schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
				requestId: "womb-1",
				revision: 1,
				status: ZLBFSyncStatus.OK,
				data: {
					snapshot: {
						dataSchemaVersion: 5,
						stateVersion: 4,
						domains: { ...createDefaultDomains(), womb: state(1) }
					}
				}
			}
		);

		expect(sendMock).toHaveBeenCalledTimes(2);
		expect(sendMock).toHaveBeenLastCalledWith(
			getPlayer(),
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.PUBLISH_WOMB_STATE_REQUEST,
			expect.objectContaining({ baseStateVersion: 4, data: { desired: state(2) } })
		);
	});

	it("does not retry when the correlated snapshot already equals the pending intent", () => {
		const snapshots = new SnapshotStore();
		const publisher = new WombPublisher(snapshots);
		publisher.publishState(state(2));
		publisher.onServerCommand(
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.PUBLISH_WOMB_STATE_RESPONSE,
			{
				schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
				requestId: "womb-1",
				revision: 1,
				status: ZLBFSyncStatus.OK,
				data: {
					snapshot: {
						dataSchemaVersion: 5,
						stateVersion: 1,
						domains: { ...createDefaultDomains(), womb: state(2) }
					}
				}
			}
		);

		expect(sendMock).toHaveBeenCalledTimes(1);
	});

	it("ignores a response with a different request or protocol schema", () => {
		const snapshots = new SnapshotStore();
		const publisher = new WombPublisher(snapshots);
		publisher.publishState(state(-6));
		const response = {
			schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
			requestId: "other",
			revision: 1,
			status: ZLBFSyncStatus.OK,
			data: {
				snapshot: {
					dataSchemaVersion: 4,
					stateVersion: 2,
					domains: { ...createDefaultDomains(), womb: { cycleDay: -6 } }
				}
			}
		};

		publisher.onServerCommand(
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.PUBLISH_WOMB_STATE_RESPONSE,
			response
		);
		publisher.onServerCommand(
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.PUBLISH_WOMB_STATE_RESPONSE,
			{ ...response, schemaVersion: 1, requestId: "womb-1" }
		);

		expect(snapshots.snapshot).toBeUndefined();
	});
});
