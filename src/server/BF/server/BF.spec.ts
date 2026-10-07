import * as Events from "@asledgehammer/pipewrench-events";
import { mockedPlayer } from "@test/mock";

jest.mock("@asledgehammer/pipewrench-events");

describe("server BF composition root", () => {
	it("registers one command listener and forwards the event player", () => {
		jest.isolateModules(() => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const { commandHandler } = require("@server/BF") as typeof import("@server/BF");
			const spy = jest.spyOn(commandHandler, "onClientCommand");
			const listener = (Events.onClientCommand.addListener as jest.Mock).mock.calls[0][0];
			const player = mockedPlayer();
			listener("module", "command", player, { value: true });
			expect(spy).toHaveBeenCalledWith("module", "command", player, { value: true });
		});
	});
});
