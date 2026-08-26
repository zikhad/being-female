import { getPlayer, sendClientCommand } from "@asledgehammer/pipewrench";
import { BirthPublisher } from "@client/components/network/BirthPublisher";
import { SnapshotStore } from "@client/components/network/SnapshotStore";
import {
	BF_NETWORK_MODULE,
	BF_PROTOCOL_SCHEMA_VERSION,
	BFNetworkCommand,
	BFSyncStatus
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
			BF_NETWORK_MODULE,
			BFNetworkCommand.ALLOCATE_BIRTH_REQUEST,
			{
				schemaVersion: BF_PROTOCOL_SCHEMA_VERSION,
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
			schemaVersion: 1,
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

		publisher.onServerCommand(BF_NETWORK_MODULE, BFNetworkCommand.ALLOCATE_BIRTH_RESPONSE, {
			schemaVersion: BF_PROTOCOL_SCHEMA_VERSION,
			requestId: "birth-allocation-1",
			revision: 1,
			status: BFSyncStatus.OK,
			data: { snapshot }
		});

		expect(snapshots.snapshot).toEqual(snapshot);
	});

	it("does not allocate when the snapshot already has a pending birth", () => {
		const snapshots = new SnapshotStore();
		snapshots.apply({
			schemaVersion: 1,
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

	it("retries the exact completion envelope on each minute until correlated resolution", () => {
		const publisher = new BirthPublisher(new SnapshotStore());
		publisher.complete("Dihgg:birth:1");
		publisher.onEveryOneMinute();
		publisher.onEveryOneMinute();

		expect(sendMock).toHaveBeenCalledTimes(3);
		expect(sendMock.mock.calls[1][3]).toBe(sendMock.mock.calls[0][3]);
		expect(sendMock.mock.calls[2][3]).toBe(sendMock.mock.calls[0][3]);

		publisher.onServerCommand(BF_NETWORK_MODULE, BFNetworkCommand.COMPLETE_BIRTH_RESPONSE, {
			schemaVersion: BF_PROTOCOL_SCHEMA_VERSION,
			requestId: "birth-completion-1",
			revision: 1,
			status: BFSyncStatus.OK,
			data: {
				snapshot: {
					schemaVersion: 1,
					stateVersion: 2,
					domains: {
						womb: createDefaultWombState(),
						lactation: createDefaultLactationState(),
						pregnancy: createDefaultPregnancyState(),
						birth: { birthSequence: 1, completedBirthId: "Dihgg:birth:1" }
					}
				}
			}
		});
		publisher.onEveryOneMinute();
		expect(sendMock).toHaveBeenCalledTimes(3);
	});

	it("clears completion correlation on a session reset", () => {
		const publisher = new BirthPublisher(new SnapshotStore());
		publisher.complete("Dihgg:birth:1");
		publisher.resetSession();
		publisher.onEveryOneMinute();
		expect(sendMock).toHaveBeenCalledTimes(1);
	});

	it("retains completion retry after a correlated response with the wrong protocol schema", () => {
		const publisher = new BirthPublisher(new SnapshotStore());
		publisher.complete("Dihgg:birth:1");
		publisher.onServerCommand(
			BF_NETWORK_MODULE,
			BFNetworkCommand.COMPLETE_BIRTH_RESPONSE,
			completionResponse(BFSyncStatus.OK, 99)
		);

		publisher.onEveryOneMinute();
		expect(sendMock).toHaveBeenCalledTimes(2);
		expect(sendMock.mock.calls[1][3]).toBe(sendMock.mock.calls[0][3]);
	});

	it("retains completion retry for an incompatible correlated response", () => {
		const publisher = new BirthPublisher(new SnapshotStore());
		publisher.complete("Dihgg:birth:1");
		publisher.onServerCommand(
			BF_NETWORK_MODULE,
			BFNetworkCommand.COMPLETE_BIRTH_RESPONSE,
			completionResponse(BFSyncStatus.UNSUPPORTED_DATA_SCHEMA)
		);

		publisher.onEveryOneMinute();
		expect(sendMock).toHaveBeenCalledTimes(2);
	});

	it("applies a compatible invalid response and retains the exact envelope while still pending", () => {
		const snapshots = new SnapshotStore();
		const publisher = new BirthPublisher(snapshots);
		publisher.complete("Dihgg:birth:1");
		const original = sendMock.mock.calls[0][3];
		const response = completionResponse(BFSyncStatus.INVALID_REQUEST);
		publisher.onServerCommand(
			BF_NETWORK_MODULE,
			BFNetworkCommand.COMPLETE_BIRTH_RESPONSE,
			response
		);

		expect(snapshots.snapshot).toEqual(response.data.snapshot);
		expect(sendMock).toHaveBeenCalledTimes(1);
		publisher.onEveryOneMinute();
		expect(sendMock).toHaveBeenCalledTimes(2);
		expect(sendMock.mock.calls[1][3]).toBe(original);
	});

	it("re-notifies reconciliation when a compatible response repeats the current version", () => {
		const snapshots = new SnapshotStore();
		const response = completionResponse(BFSyncStatus.INVALID_REQUEST);
		snapshots.apply(response.data.snapshot);
		const listener = jest.fn();
		snapshots.subscribe(listener);
		const publisher = new BirthPublisher(snapshots);
		publisher.complete("Dihgg:birth:1");

		publisher.onServerCommand(
			BF_NETWORK_MODULE,
			BFNetworkCommand.COMPLETE_BIRTH_RESPONSE,
			response
		);

		expect(listener).toHaveBeenCalledWith(response.data.snapshot);
	});

	it("does not create an immediate request storm when pending reconciliation resubmits", () => {
		const snapshots = new SnapshotStore();
		const response = completionResponse(BFSyncStatus.INVALID_REQUEST);
		snapshots.apply(response.data.snapshot);
		const publisher = new BirthPublisher(snapshots);
		publisher.complete("Dihgg:birth:1");
		const original = sendMock.mock.calls[0][3];
		snapshots.subscribe(snapshot => {
			const pendingBirthId = snapshot.domains.birth.pendingBirthId;
			if (pendingBirthId) publisher.complete(pendingBirthId);
		});

		publisher.onServerCommand(
			BF_NETWORK_MODULE,
			BFNetworkCommand.COMPLETE_BIRTH_RESPONSE,
			response
		);

		expect(sendMock).toHaveBeenCalledTimes(1);
		publisher.onEveryOneMinute();
		expect(sendMock).toHaveBeenCalledTimes(2);
		expect(sendMock.mock.calls[1][3]).toBe(original);
	});
});

/** Creates a correlated completion response with a still-pending authoritative birth. */
const completionResponse = (status: BFSyncStatus, schemaVersion = BF_PROTOCOL_SCHEMA_VERSION) => ({
	schemaVersion,
	requestId: "birth-completion-1",
	revision: 1,
	status,
	data: {
		snapshot: {
			schemaVersion: 1,
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
		}
	}
});
