import * as Events from "@asledgehammer/pipewrench-events";
import { mockedPlayer } from "@test/mock";
import { ZLBFSyncPublisher } from "@client/components/ZLBFSyncPublisher";
import { ZLBFSyncCoordinator } from "@client/components/ZLBFSyncCoordinator";

jest.mock("@asledgehammer/pipewrench-events");

describe("ZLBFSyncCoordinator", () => {
	it("registers one global listener per transport event and only binds on player creation", () => {
		const publisher = {
			bindPlayer: jest.fn(),
			onEveryOneMinute: jest.fn(),
			onServerCommand: jest.fn()
		} as unknown as ZLBFSyncPublisher;
		new ZLBFSyncCoordinator(publisher);

		expect(Events.onCreatePlayer.addListener).toHaveBeenCalledTimes(1);
		expect(Events.everyOneMinute.addListener).toHaveBeenCalledTimes(1);
		expect(Events.onServerCommand.addListener).toHaveBeenCalledTimes(1);
		const create = (Events.onCreatePlayer.addListener as jest.Mock).mock.calls[0][0];
		create(0, mockedPlayer());
		expect(publisher.bindPlayer).toHaveBeenCalledTimes(1);
		expect(publisher.onEveryOneMinute).not.toHaveBeenCalled();
	});
});
