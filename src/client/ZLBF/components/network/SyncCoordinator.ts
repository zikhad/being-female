import * as Events from "@asledgehammer/pipewrench-events";
import { SyncPublisher } from "@client/components/network/SyncPublisher";

/** Client network component capable of receiving Project Zomboid server commands. */
export type ServerCommandReceiver = {
	/** Routes one untrusted server command to the component. */
	onServerCommand(module: string, command: string, args: unknown): void;
};

/** Registers the singleton client-side Project Zomboid events used by state synchronization. */
export class SyncCoordinator {
	/**
	 * Connects minute ticks and server commands to the supplied publisher.
	 * Construct this coordinator only once to avoid duplicate global event listeners.
	 *
	 * @param publisher Publisher responsible for request and response state.
	 * @param receivers Network components that should inspect each server command.
	 */
	constructor(
		private readonly publisher: SyncPublisher,
		private readonly receivers: ServerCommandReceiver[] = [publisher]
	) {
		Events.everyOneMinute.addListener(() => this.publisher.onEveryOneMinute());
		Events.onServerCommand.addListener((module, command, args) => {
			for (const receiver of this.receivers) {
				receiver.onServerCommand(module, command, args);
			}
		});
	}
}
