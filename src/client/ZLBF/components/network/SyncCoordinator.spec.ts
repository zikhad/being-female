import * as Events from "@asledgehammer/pipewrench-events";
import { SyncPublisher } from "@client/components/network/SyncPublisher";
import { SyncCoordinator } from "@client/components/network/SyncCoordinator";

jest.mock("@asledgehammer/pipewrench-events");

describe("SyncCoordinator", () => {
	beforeEach(() => jest.clearAllMocks());

	it("registers one global listener per transport event", () => {
		const publisher = {
			onEveryOneMinute: jest.fn(),
			onServerCommand: jest.fn()
		} as unknown as SyncPublisher;
		new SyncCoordinator(publisher);

		expect(Events.everyOneMinute.addListener).toHaveBeenCalledTimes(1);
		expect(Events.onServerCommand.addListener).toHaveBeenCalledTimes(1);
	});

	it("forwards each server command to every receiver", () => {
		const publisher = {
			onEveryOneMinute: jest.fn(),
			onServerCommand: jest.fn()
		} as unknown as SyncPublisher;
		const other = { onServerCommand: jest.fn() };
		new SyncCoordinator(publisher, [publisher, other]);
		const listener = (Events.onServerCommand.addListener as jest.Mock).mock.calls[0][0];

		listener("module", "command", { value: true });

		expect(publisher.onServerCommand).toHaveBeenCalledWith("module", "command", {
			value: true
		});
		expect(other.onServerCommand).toHaveBeenCalledWith("module", "command", { value: true });
	});
});
