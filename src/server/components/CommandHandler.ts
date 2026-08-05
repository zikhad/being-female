import { IsoPlayer, sendServerCommand } from "@asledgehammer/pipewrench";
import {
	ZLBF_DATA_SCHEMA_VERSION,
	ZLBF_NETWORK_MODULE,
	ZLBF_PROTOCOL_SCHEMA_VERSION,
	ZLBFNetworkCommand,
	ZLBFSyncStatus
} from "@constants";
import { isZLBFSyncStateRequest, ZLBFSyncStateResponse } from "@shared/ZLBFProtocol";
import { StateRepository } from "@server/components/state/StateRepository";

/** Validates and handles ZLBF commands received in the server execution context. */
export class CommandHandler {
	/** Creates a handler backed by the server-owned player-state repository. */
	constructor(private readonly states = new StateRepository()) {}

	/**
	 * Routes a read-only snapshot request and replies directly to its authenticated player.
	 * The event-supplied player is authoritative; payload data is never used to select a player.
	 *
	 * @param module Project Zomboid command module.
	 * @param command Command name within the module.
	 * @param player Authenticated player supplied by `OnClientCommand`.
	 * @param args Untrusted command payload supplied by Project Zomboid.
	 */
	public onClientCommand(
		module: string,
		command: string,
		player: IsoPlayer,
		args: unknown
	): void {
		if (module !== ZLBF_NETWORK_MODULE || command !== ZLBFNetworkCommand.SYNC_STATE_REQUEST)
			return;
		const label = player.getUsername();
		if (!isZLBFSyncStateRequest(args)) {
			print(`[ZLBF][MP][Server] rejected malformed request from ${label}`);
			return;
		}
		const protocolSupported = args.schemaVersion === ZLBF_PROTOCOL_SCHEMA_VERSION;
		const state = protocolSupported ? this.states.load(player) : undefined;
		const status = !protocolSupported
			? ZLBFSyncStatus.UNSUPPORTED_SCHEMA
			: state?.supported
				? ZLBFSyncStatus.OK
				: ZLBFSyncStatus.UNSUPPORTED_DATA_SCHEMA;
		const response: ZLBFSyncStateResponse = {
			schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
			requestId: args.requestId,
			revision: args.revision,
			status,
			data: {
				snapshot: {
					dataSchemaVersion: state?.dataSchemaVersion ?? ZLBF_DATA_SCHEMA_VERSION,
					stateVersion: state?.stateVersion ?? 0
				}
			}
		};
		print(
			`[ZLBF][MP][Server] reply ${response.requestId} revision=${response.revision} status=${response.status}`
		);
		sendServerCommand(
			player,
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.SYNC_STATE_RESPONSE,
			response
		);
	}
}
