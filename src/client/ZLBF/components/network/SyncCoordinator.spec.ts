import * as Events from "@asledgehammer/pipewrench-events";
import { SyncPublisher } from "@client/components/network/SyncPublisher";
import { SyncCoordinator } from "@client/components/network/SyncCoordinator";

jest.mock("@asledgehammer/pipewrench-events");

describe("SyncCoordinator", () => {
	it("registers one global listener per transport event", () => {
		const publisher = {
			onEveryOneMinute: jest.fn(),
			onServerCommand: jest.fn()
		} as unknown as SyncPublisher;
		new SyncCoordinator(publisher);

		expect(Events.everyOneMinute.addListener).toHaveBeenCalledTimes(1);
		expect(Events.onServerCommand.addListener).toHaveBeenCalledTimes(1);
	});
});
