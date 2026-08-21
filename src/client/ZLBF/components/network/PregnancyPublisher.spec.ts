import { getPlayer, sendClientCommand } from "@asledgehammer/pipewrench";
import {
	ZLBF_NETWORK_MODULE,
	ZLBF_PROTOCOL_SCHEMA_VERSION,
	ZLBFNetworkCommand,
	ZLBFSyncStatus
} from "@constants";
import { PregnancyPublisher } from "@client/components/network/PregnancyPublisher";
import { SnapshotStore } from "@client/components/network/SnapshotStore";
import { createDefaultBirthState } from "@shared/domain/birth/BirthState";
import { createDefaultDomains } from "@shared/ZLBFState";
import {
	createDefaultPregnancyState,
	PregnancyStatus
} from "@shared/domain/pregnancy/PregnancyState";
import { mockedPlayer } from "@test/mock";

jest.mock("@asledgehammer/pipewrench");

describe("PregnancyPublisher", () => {
	const sendMock = sendClientCommand as jest.MockedFunction<typeof sendClientCommand>;
	const getPlayerMock = getPlayer as jest.MockedFunction<typeof getPlayer>;

	beforeEach(() => {
		sendMock.mockReset();
		getPlayerMock.mockReset();
		getPlayerMock.mockReturnValue(mockedPlayer());
	});

	it("coalesces pending changes and sends only the latest desired state after acknowledgement", () => {
		const publisher = new PregnancyPublisher(new SnapshotStore());
		const desired = {
			...createDefaultPregnancyState(),
			status: PregnancyStatus.PREGNANT
		};
		publisher.setState(desired);
		publisher.publishState({ ...desired, current: 1, progress: 0.1 });
		const latest = { ...desired, current: 2, progress: 0.2 };
		publisher.publishState(latest);
		expect(publisher.latestDesiredState).toEqual(latest);

		expect(sendMock).toHaveBeenCalledTimes(1);
		expect(sendMock).toHaveBeenCalledWith(
			getPlayerMock.mock.results[0].value,
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.SET_PREGNANCY_STATE_REQUEST,
			expect.objectContaining({ data: { desired } })
		);

		publisher.onServerCommand(
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.SET_PREGNANCY_STATE_RESPONSE,
			{
				schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
				requestId: "pregnancy-1",
				revision: 1,
				status: ZLBFSyncStatus.OK,
				data: {
					snapshot: {
						schemaVersion: 1,
						stateVersion: 1,
						domains: {
							...createDefaultDomains(),
							pregnancy: desired,
							birth: createDefaultBirthState()
						}
					}
				}
			}
		);

		expect(sendMock).toHaveBeenCalledTimes(2);
		expect(publisher.latestDesiredState).toEqual(latest);
		expect(sendMock).toHaveBeenLastCalledWith(
			getPlayerMock.mock.results[1].value,
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.PUBLISH_PREGNANCY_STATE_REQUEST,
			expect.objectContaining({ revision: 2, data: { desired: latest } })
		);
	});

	it("publishes normal progression through its non-debug route", () => {
		const publisher = new PregnancyPublisher(new SnapshotStore());
		const desired = {
			...createDefaultPregnancyState(),
			status: PregnancyStatus.PREGNANT,
			current: 1,
			progress: 0.1
		};

		publisher.publishState(desired);

		expect(sendMock).toHaveBeenCalledWith(
			getPlayerMock.mock.results[0].value,
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.PUBLISH_PREGNANCY_STATE_REQUEST,
			expect.objectContaining({ data: { desired } })
		);
	});

	it("applies only an exactly correlated compatible response", () => {
		const snapshots = new SnapshotStore();
		const publisher = new PregnancyPublisher(snapshots);
		publisher.setState(createDefaultPregnancyState());
		const snapshot = {
			schemaVersion: 1,
			stateVersion: 1,
			domains: createDefaultDomains()
		};

		publisher.onServerCommand(
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.SET_PREGNANCY_STATE_RESPONSE,
			{
				schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
				requestId: "wrong",
				revision: 1,
				status: ZLBFSyncStatus.OK,
				data: { snapshot }
			}
		);
		expect(snapshots.snapshot).toBeUndefined();

		publisher.onServerCommand(
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.SET_PREGNANCY_STATE_RESPONSE,
			{
				schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
				requestId: "pregnancy-1",
				revision: 1,
				status: ZLBFSyncStatus.OK,
				data: { snapshot }
			}
		);
		expect(snapshots.snapshot).toEqual(snapshot);
	});

	it("clears pending and queued optimism on session reset", () => {
		const publisher = new PregnancyPublisher(new SnapshotStore());
		publisher.publishState(createDefaultPregnancyState());
		publisher.publishState({
			...createDefaultPregnancyState(),
			status: PregnancyStatus.PREGNANT
		});
		publisher.resetSession();
		expect(publisher.latestDesiredState).toBeUndefined();
	});
});
