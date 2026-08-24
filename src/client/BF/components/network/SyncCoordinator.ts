import * as Events from "@asledgehammer/pipewrench-events";

/** Client network component capable of receiving Project Zomboid server commands. */
export type ServerCommandReceiver = {
	/** Routes one untrusted server command to the component. */
	onServerCommand(module: string, command: string, args: unknown): void;
};

/** Component that owns state scoped to one multiplayer connection. */
export type SessionResettable = {
	/** Clears request, acknowledgement, retry, or optimistic state without sending. */
	resetSession(): void;
};

/** Component invoked from the shared client minute lifecycle. */
export type MinutePublisher = {
	/** Performs minute-deferred bootstrap or retry work. */
	onEveryOneMinute(): void;
};

/** Explicit capability lists wired to the singleton client network lifecycle. */
export type SyncCoordinatorConfig = {
	/** Components that inspect incoming server commands. */
	commandReceivers: ServerCommandReceiver[];
	/** Components, including the snapshot store, reset at connection boundaries. */
	sessionResettables: SessionResettable[];
	/** Components invoked exactly once per shared in-game minute callback. */
	minutePublishers: MinutePublisher[];
};

/** Registers the singleton client-side Project Zomboid events used by state synchronization. */
export class SyncCoordinator {
	/**
	 * Connects minute ticks and server commands to the supplied publisher.
	 * Construct this coordinator only once to avoid duplicate global event listeners.
	 *
	 * @param config Explicit receiver, reset, and minute capabilities to register.
	 */
	constructor(private readonly config: SyncCoordinatorConfig) {
		Events.everyOneMinute.addListener(() => {
			for (const publisher of this.config.minutePublishers) publisher.onEveryOneMinute();
		});
		Events.onServerCommand.addListener((module, command, args) => {
			for (const receiver of this.config.commandReceivers) {
				receiver.onServerCommand(module, command, args);
			}
		});
		const reset = () => this.resetSession();
		Events.onDisconnect.addListener(reset);
		Events.onConnected.addListener(reset);
	}

	/** Idempotently clears connection-scoped state without sending network commands. */
	private resetSession(): void {
		for (const resettable of this.config.sessionResettables) resettable.resetSession();
	}
}
