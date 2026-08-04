import { IsoPlayer, sendServerCommand } from "@asledgehammer/pipewrench";
import {
	ZLBF_DATA_SCHEMA_VERSION,
	ZLBF_NETWORK_MODULE,
	ZLBF_PROTOCOL_SCHEMA_VERSION,
	ZLBFNetworkCommand,
	ZLBFSyncStatus
} from "@constants";
import { isZLBFSyncStateRequest, ZLBFSyncStateResponse } from "@shared/ZLBFProtocol";

export class ZLBFCommandHandler {
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
		const status =
			args.schemaVersion === ZLBF_PROTOCOL_SCHEMA_VERSION
				? ZLBFSyncStatus.OK
				: ZLBFSyncStatus.UNSUPPORTED_SCHEMA;
		const response: ZLBFSyncStateResponse = {
			schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
			requestId: args.requestId,
			revision: args.revision,
			status,
			data: {
				snapshot: { dataSchemaVersion: ZLBF_DATA_SCHEMA_VERSION, stateVersion: 0 }
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
