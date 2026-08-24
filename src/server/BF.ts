import * as Events from "@asledgehammer/pipewrench-events";
import { CommandHandler } from "@server/components/CommandHandler";

/** Singleton command handler for the server Lua execution context. */
export const commandHandler = new CommandHandler();

Events.onClientCommand.addListener((module, command, player, args) =>
	commandHandler.onClientCommand(module, command, player, args)
);
