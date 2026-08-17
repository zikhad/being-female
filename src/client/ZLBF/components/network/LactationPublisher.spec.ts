import { getPlayer, sendClientCommand } from "@asledgehammer/pipewrench";
import {
	composeLactationIntent,
	LactationPublisher,
	rebaseLactationState
} from "@client/components/network/LactationPublisher";
import { SnapshotStore } from "@client/components/network/SnapshotStore";
import {
	ZLBF_NETWORK_MODULE,
	ZLBF_PROTOCOL_SCHEMA_VERSION,
	ZLBFNetworkCommand,
	ZLBFSyncStatus
} from "@constants";
import { createDefaultDomains } from "@shared/ZLBFState";
import type { LactationState } from "@shared/domain/lactation/LactationState";

jest.mock("@asledgehammer/pipewrench");

const state = (milkAmount: number): LactationState => ({
	isActive: true,
	milkAmount,
	expiration: 8,
	multiplier: 0
});

describe("LactationPublisher", () => {
	const sendMock = sendClientCommand as jest.MockedFunction<typeof sendClientCommand>;
	beforeEach(() => sendMock.mockReset());

	it("sends one versioned complete state and coalesces later simulation", () => {
		const snapshots = new SnapshotStore();
		snapshots.apply({
			dataSchemaVersion: 5,
			stateVersion: 3,
			domains: { ...createDefaultDomains(), lactation: state(0.4) }
		});
		const publisher = new LactationPublisher(snapshots);
		publisher.publishState(state(0.5));
		publisher.publishState(state(0.6));
		expect(sendMock).toHaveBeenCalledTimes(1);
		expect(sendMock).toHaveBeenCalledWith(
			getPlayer(),
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.PUBLISH_LACTATION_STATE_REQUEST,
			expect.objectContaining({ baseStateVersion: 3, data: { desired: state(0.5) } })
		);
	});

	it("does not retry an accepted equivalent state", () => {
		const snapshots = new SnapshotStore();
		const publisher = new LactationPublisher(snapshots);
		publisher.publishState(state(0.5));
		publisher.onServerCommand(
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.PUBLISH_LACTATION_STATE_RESPONSE,
			{
				schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
				requestId: "lactation-1",
				revision: 1,
				status: ZLBFSyncStatus.OK,
				data: {
					snapshot: {
						dataSchemaVersion: 5,
						stateVersion: 1,
						domains: { ...createDefaultDomains(), lactation: state(0.5) }
					}
				}
			}
		);
		expect(sendMock).toHaveBeenCalledTimes(1);
	});

	it("rebases simulation delta over authoritative recipe milk consumption", () => {
		const snapshots = new SnapshotStore();
		snapshots.apply({
			dataSchemaVersion: 5,
			stateVersion: 1,
			domains: { ...createDefaultDomains(), lactation: state(0.5) }
		});
		const publisher = new LactationPublisher(snapshots);
		publisher.publishState(state(0.6), { milkAmount: { mode: "delta", value: 0.1 } });
		publisher.publishState(state(0.7), { milkAmount: { mode: "delta", value: 0.1 } });
		publisher.onServerCommand(
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.PUBLISH_LACTATION_STATE_RESPONSE,
			{
				schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
				requestId: "lactation-1",
				revision: 1,
				status: ZLBFSyncStatus.OK,
				data: {
					snapshot: {
						dataSchemaVersion: 5,
						stateVersion: 2,
						domains: { ...createDefaultDomains(), lactation: state(0.3) }
					}
				}
			}
		);
		expect(sendMock).toHaveBeenCalledTimes(2);
		const request = sendMock.mock.calls[1][3] as {
			baseStateVersion: number;
			data: { desired: LactationState };
		};
		expect(request.baseStateVersion).toBe(2);
		expect(request.data.desired.milkAmount).toBeCloseTo(0.5);
	});

	it("applies only the queued delta after the pending state was accepted", () => {
		const snapshots = new SnapshotStore();
		snapshots.apply({
			dataSchemaVersion: 5,
			stateVersion: 1,
			domains: { ...createDefaultDomains(), lactation: state(0.5) }
		});
		const publisher = new LactationPublisher(snapshots);
		publisher.publishState(state(0.6), { milkAmount: { mode: "delta", value: 0.1 } });
		publisher.publishState(state(0.7), { milkAmount: { mode: "delta", value: 0.1 } });
		publisher.onServerCommand(
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.PUBLISH_LACTATION_STATE_RESPONSE,
			{
				schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
				requestId: "lactation-1",
				revision: 1,
				status: ZLBFSyncStatus.OK,
				data: {
					snapshot: {
						dataSchemaVersion: 5,
						stateVersion: 2,
						domains: { ...createDefaultDomains(), lactation: state(0.6) }
					}
				}
			}
		);
		const request = sendMock.mock.calls[1][3] as { data: { desired: LactationState } };
		expect(request.data.desired.milkAmount).toBeCloseTo(0.7);
	});

	it("clears queued optimism after an unsupported response", () => {
		const publisher = new LactationPublisher(new SnapshotStore());
		publisher.publishState(state(0.5));
		publisher.publishState(state(0.6));
		publisher.onServerCommand(
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.PUBLISH_LACTATION_STATE_RESPONSE,
			{
				schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
				requestId: "lactation-1",
				revision: 1,
				status: ZLBFSyncStatus.UNSUPPORTED_DATA_SCHEMA,
				data: {
					snapshot: {
						dataSchemaVersion: 99,
						stateVersion: 1,
						domains: { ...createDefaultDomains(), lactation: state(0.4) }
					}
				}
			}
		);
		expect(publisher.latestDesiredState).toBeUndefined();
		expect(sendMock).toHaveBeenCalledTimes(1);
	});

	it("retries the same correlated request after two pending minute ticks", () => {
		const publisher = new LactationPublisher(new SnapshotStore());
		publisher.publishState(state(0.5));
		publisher.publishState(state(0.6));
		publisher.onEveryOneMinute();
		expect(sendMock).toHaveBeenCalledTimes(1);
		publisher.onEveryOneMinute();
		expect(sendMock).toHaveBeenCalledTimes(2);
		expect(sendMock.mock.calls[1][3]).toBe(sendMock.mock.calls[0][3]);
		expect(publisher.latestDesiredState).toEqual(state(0.6));
	});

	it("rebases activity replacement and numeric expiration/multiplier deltas", () => {
		const base = { isActive: false, milkAmount: 0.5, expiration: 8, multiplier: 0.2 };
		const desired = { isActive: true, milkAmount: 0.5, expiration: 6, multiplier: 0.5 };
		const authoritative = { isActive: false, milkAmount: 0.3, expiration: 10, multiplier: 0.1 };
		const rebased = rebaseLactationState(
			{
				isActive: { mode: "replace", value: desired.isActive },
				expiration: { mode: "delta", value: -2 },
				multiplier: { mode: "delta", value: 0.3 }
			},
			authoritative
		);
		expect(rebased.isActive).toBe(true);
		expect(rebased.expiration).toBe(8);
		expect(rebased.milkAmount).toBeCloseTo(0.3);
		expect(rebased.multiplier).toBeCloseTo(0.4);
	});

	it("accumulates multiple queued production deltas", () => {
		const first = composeLactationIntent(
			undefined,
			{ milkAmount: { mode: "delta", value: 0.1 } },
			state(0.6)
		);
		const second = composeLactationIntent(
			first,
			{ milkAmount: { mode: "delta", value: 0.2 } },
			state(0.8)
		);
		expect(second.milkAmount?.mode).toBe("delta");
		expect(second.milkAmount?.value).toBeCloseTo(0.3);
	});

	it("keeps replacement semantics when a later delta adjusts it", () => {
		const replacement = composeLactationIntent(
			undefined,
			{ multiplier: { mode: "replace", value: 0.5 } },
			{ ...state(0.5), multiplier: 0.5 }
		);
		const adjusted = composeLactationIntent(
			replacement,
			{ multiplier: { mode: "delta", value: -0.1 } },
			{ ...state(0.5), multiplier: 0.4 }
		);
		expect(adjusted.multiplier).toEqual({ mode: "replace", value: 0.4 });
	});
});
