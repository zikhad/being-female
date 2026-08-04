import * as Events from "@asledgehammer/pipewrench-events";
import { ZLBFCommandHandler } from "@server/components/ZLBFCommandHandler";

export const commandHandler = new ZLBFCommandHandler();

Events.onClientCommand.addListener((module, command, player, args) =>
	commandHandler.onClientCommand(module, command, player, args)
);
