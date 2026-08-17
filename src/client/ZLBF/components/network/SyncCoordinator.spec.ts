import * as Events from "@asledgehammer/pipewrench-events";
import { SyncCoordinator } from "@client/components/network/SyncCoordinator";

jest.mock("@asledgehammer/pipewrench-events");

describe("SyncCoordinator", () => {
	beforeEach(() => jest.clearAllMocks());

	const createCapabilities = () => ({
		receiver: { onServerCommand: jest.fn() },
		resettable: { resetSession: jest.fn() },
		minutePublisher: { onEveryOneMinute: jest.fn() }
	});

	it("registers one global listener per transport event", () => {
		const capabilities = createCapabilities();
		new SyncCoordinator({
			commandReceivers: [capabilities.receiver],
			sessionResettables: [capabilities.resettable],
			minutePublishers: [capabilities.minutePublisher]
		});

		expect(Events.everyOneMinute.addListener).toHaveBeenCalledTimes(1);
		expect(Events.onServerCommand.addListener).toHaveBeenCalledTimes(1);
		expect(Events.onConnected.addListener).toHaveBeenCalledTimes(1);
		expect(Events.onDisconnect.addListener).toHaveBeenCalledTimes(1);
	});

	it("routes only the capability associated with each event", () => {
		const capabilities = createCapabilities();
		new SyncCoordinator({
			commandReceivers: [capabilities.receiver],
			sessionResettables: [capabilities.resettable],
			minutePublishers: [capabilities.minutePublisher]
		});
		const serverCommand = (Events.onServerCommand.addListener as jest.Mock).mock.calls[0][0];
		const minute = (Events.everyOneMinute.addListener as jest.Mock).mock.calls[0][0];
		const connected = (Events.onConnected.addListener as jest.Mock).mock.calls[0][0];

		serverCommand("module", "command", { value: true });
		expect(capabilities.receiver.onServerCommand).toHaveBeenCalledTimes(1);
		expect(capabilities.resettable.resetSession).not.toHaveBeenCalled();
		expect(capabilities.minutePublisher.onEveryOneMinute).not.toHaveBeenCalled();

		minute();
		expect(capabilities.minutePublisher.onEveryOneMinute).toHaveBeenCalledTimes(1);
		expect(capabilities.resettable.resetSession).not.toHaveBeenCalled();

		connected();
		expect(capabilities.resettable.resetSession).toHaveBeenCalledTimes(1);
		expect(capabilities.minutePublisher.onEveryOneMinute).toHaveBeenCalledTimes(1);
	});

	it("resets every explicit reset capability on both connection boundaries", () => {
		const first = { resetSession: jest.fn() };
		const second = { resetSession: jest.fn() };
		new SyncCoordinator({
			commandReceivers: [],
			sessionResettables: [first, second],
			minutePublishers: []
		});
		const connected = (Events.onConnected.addListener as jest.Mock).mock.calls[0][0];
		const disconnected = (Events.onDisconnect.addListener as jest.Mock).mock.calls[0][0];

		connected();
		disconnected();

		expect(first.resetSession).toHaveBeenCalledTimes(2);
		expect(second.resetSession).toHaveBeenCalledTimes(2);
	});

	it("invokes each explicit minute publisher exactly once", () => {
		const sync = { onEveryOneMinute: jest.fn() };
		const birth = { onEveryOneMinute: jest.fn() };
		new SyncCoordinator({
			commandReceivers: [],
			sessionResettables: [],
			minutePublishers: [sync, birth]
		});
		const minute = (Events.everyOneMinute.addListener as jest.Mock).mock.calls[0][0];

		minute();

		expect(sync.onEveryOneMinute).toHaveBeenCalledTimes(1);
		expect(birth.onEveryOneMinute).toHaveBeenCalledTimes(1);
	});
});
