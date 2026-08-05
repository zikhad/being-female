import * as Events from "@asledgehammer/pipewrench-events";
import { SyncPublisher } from "@client/components/network/SyncPublisher";

/** Registers the singleton client-side Project Zomboid events used by state synchronization. */
export class SyncCoordinator {
	/**
	 * Connects minute ticks and server commands to the supplied publisher.
	 * Construct this coordinator only once to avoid duplicate global event listeners.
	 *
	 * @param publisher Publisher responsible for request and response state.
	 */
	constructor(private readonly publisher: SyncPublisher) {
		Events.everyOneMinute.addListener(() => this.publisher.onEveryOneMinute());
		Events.onServerCommand.addListener((module, command, args) =>
			this.publisher.onServerCommand(module, command, args)
		);
	}
}
