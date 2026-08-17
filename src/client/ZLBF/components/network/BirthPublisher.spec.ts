import { getPlayer, sendClientCommand } from "@asledgehammer/pipewrench";
import { BirthPublisher } from "@client/components/network/BirthPublisher";
import { SnapshotStore } from "@client/components/network/SnapshotStore";
import {
	ZLBF_NETWORK_MODULE,
	ZLBF_PROTOCOL_SCHEMA_VERSION,
	ZLBFNetworkCommand,
	ZLBFSyncStatus
} from "@constants";
import { createDefaultBirthState } from "@shared/domain/birth/BirthState";
import {
	createDefaultPregnancyState,
	PregnancyStatus
} from "@shared/domain/pregnancy/PregnancyState";
import { createDefaultWombState } from "@shared/domain/womb/WombState";
import { createDefaultLactationState } from "@shared/domain/lactation/LactationState";

jest.mock("@asledgehammer/pipewrench");

describe("BirthPublisher", () => {
	const sendMock = sendClientCommand as jest.MockedFunction<typeof sendClientCommand>;

	beforeEach(() => sendMock.mockReset());

	it("sends only one allocation while its request is pending", () => {
		const publisher = new BirthPublisher(new SnapshotStore());

		publisher.allocate();
		publisher.allocate();

		expect(sendMock).toHaveBeenCalledTimes(1);
		expect(sendMock).toHaveBeenCalledWith(
			getPlayer(),
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.ALLOCATE_BIRTH_REQUEST,
			{
				schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
				requestId: "birth-allocation-1",
				revision: 1,
				data: {}
			}
		);
	});

	it("applies an exactly correlated successful allocation response", () => {
		const snapshots = new SnapshotStore();
		const publisher = new BirthPublisher(snapshots);
		publisher.allocate();
		const snapshot = {
			dataSchemaVersion: 3,
			stateVersion: 2,
			domains: {
				womb: createDefaultWombState(),
				lactation: createDefaultLactationState(),
				pregnancy: {
					...createDefaultPregnancyState(),
					status: PregnancyStatus.PREGNANT,
					isInLabor: true
				},
				birth: { birthSequence: 1, pendingBirthId: "Dihgg:birth:1" }
			}
		};

		publisher.onServerCommand(ZLBF_NETWORK_MODULE, ZLBFNetworkCommand.ALLOCATE_BIRTH_RESPONSE, {
			schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
			requestId: "birth-allocation-1",
			revision: 1,
			status: ZLBFSyncStatus.OK,
			data: { snapshot }
		});

		expect(snapshots.snapshot).toEqual(snapshot);
	});

	it("does not allocate when the snapshot already has a pending birth", () => {
		const snapshots = new SnapshotStore();
		snapshots.apply({
			dataSchemaVersion: 3,
			stateVersion: 1,
			domains: {
				womb: createDefaultWombState(),
				lactation: createDefaultLactationState(),
				pregnancy: createDefaultPregnancyState(),
				birth: {
					...createDefaultBirthState(),
					birthSequence: 1,
					pendingBirthId: "Dihgg:birth:1"
				}
			}
		});

		new BirthPublisher(snapshots).allocate();

		expect(sendMock).not.toHaveBeenCalled();
	});
});
