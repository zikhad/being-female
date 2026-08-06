import { getPlayer, sendClientCommand } from "@asledgehammer/pipewrench";
import { ZLBF_NETWORK_MODULE, ZLBFNetworkCommand, ZLBFSyncStatus } from "@constants";
import { PregnancyPublisher } from "@client/components/network/PregnancyPublisher";
import { SnapshotStore } from "@client/components/network/SnapshotStore";
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

	it("sends one desired state while a mutation is pending", () => {
		const publisher = new PregnancyPublisher(new SnapshotStore());
		const desired = {
			...createDefaultPregnancyState(),
			status: PregnancyStatus.PREGNANT
		};
		publisher.setState(desired);
		publisher.setState(createDefaultPregnancyState());

		expect(sendMock).toHaveBeenCalledTimes(1);
		expect(sendMock).toHaveBeenCalledWith(
			getPlayerMock.mock.results[0].value,
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.SET_PREGNANCY_STATE_REQUEST,
			expect.objectContaining({ data: { desired } })
		);
	});

	it("applies only an exactly correlated compatible response", () => {
		const snapshots = new SnapshotStore();
		const publisher = new PregnancyPublisher(snapshots);
		publisher.setState(createDefaultPregnancyState());
		const snapshot = {
			dataSchemaVersion: 2,
			stateVersion: 1,
			domains: { pregnancy: createDefaultPregnancyState() }
		};

		publisher.onServerCommand(
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.SET_PREGNANCY_STATE_RESPONSE,
			{
				schemaVersion: 1,
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
				schemaVersion: 1,
				requestId: "pregnancy-1",
				revision: 1,
				status: ZLBFSyncStatus.OK,
				data: { snapshot }
			}
		);
		expect(snapshots.snapshot).toEqual(snapshot);
	});
});
