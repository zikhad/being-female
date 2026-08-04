import * as Events from "@asledgehammer/pipewrench-events";
import { mockedPlayer } from "@test/mock";

jest.mock("@asledgehammer/pipewrench-events");

describe("server ZLBF composition root", () => {
	it("registers one command listener and forwards the event player", () => {
		jest.isolateModules(() => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const { commandHandler } = require("@server/ZLBF") as typeof import("@server/ZLBF");
			const spy = jest.spyOn(commandHandler, "onClientCommand");
			const listener = (Events.onClientCommand.addListener as jest.Mock).mock.calls[0][0];
			const player = mockedPlayer();
			listener("module", "command", player, { value: true });
			expect(spy).toHaveBeenCalledWith("module", "command", player, { value: true });
		});
	});
});
