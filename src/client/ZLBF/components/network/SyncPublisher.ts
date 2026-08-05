import { getPlayer, sendClientCommand } from "@asledgehammer/pipewrench";
import {
	ZLBF_NETWORK_MODULE,
	ZLBF_PROTOCOL_SCHEMA_VERSION,
	ZLBFNetworkCommand,
	ZLBFSyncStatus
} from "@constants";
import {
	isZLBFSyncStateResponse,
	ZLBFSyncStateRequest,
	ZLBFSyncStateResponse
} from "@shared/ZLBFProtocol";
import { SnapshotStore } from "@client/components/network/SnapshotStore";

/**
 * Publishes one read-only snapshot request and accepts its correlated server response.
 *
 * The first send is deferred until `EveryOneMinute`, where runtime testing established
 * that `getPlayer()` is available. This initial slice intentionally performs no retry;
 * a pending or acknowledged request prevents subsequent sends.
 */
export class SyncPublisher {
	private nextRevision = 1;
	private pending?: ZLBFSyncStateRequest;
	private acknowledged?: ZLBFSyncStateResponse;

	/**
	 * Creates a publisher backed by the client-side authoritative snapshot mirror.
	 *
	 * @param snapshots Store updated after a valid successful response is acknowledged.
	 */
	constructor(private readonly snapshots: SnapshotStore) {}

	/** Sends the initial snapshot request on the first eligible in-game minute tick. */
	public onEveryOneMinute(): void {
		if (this.pending || this.acknowledged) return;

		const player = getPlayer();
		const revision = this.nextRevision++;
		const payload: ZLBFSyncStateRequest = {
			schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
			requestId: `snapshot-${revision}`,
			revision,
			data: {}
		};
		this.pending = payload;

		print(
			`[ZLBF][MP][Client] send ${ZLBFNetworkCommand.SYNC_STATE_REQUEST} request=${payload.requestId} revision=${payload.revision}`
		);
		sendClientCommand(
			player,
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.SYNC_STATE_REQUEST,
			payload
		);
	}

	/**
	 * Routes and validates server responses before acknowledging the pending request.
	 * Unrelated, malformed, unsolicited, late, or mismatched responses are ignored.
	 *
	 * @param module Project Zomboid command module.
	 * @param command Command name within the module.
	 * @param args Untrusted command payload supplied by Project Zomboid.
	 */
	public onServerCommand(module: string, command: string, args: unknown): void {
		if (module !== ZLBF_NETWORK_MODULE || command !== ZLBFNetworkCommand.SYNC_STATE_RESPONSE)
			return;
		if (!isZLBFSyncStateResponse(args)) {
			print("[ZLBF][MP][Client] ignored malformed SyncStateResponse");
			return;
		}
		const pending = this.pending;
		if (
			!pending ||
			args.requestId !== pending.requestId ||
			args.revision !== pending.revision ||
			args.schemaVersion !== ZLBF_PROTOCOL_SCHEMA_VERSION
		) {
			print("[ZLBF][MP][Client] ignored uncorrelated SyncStateResponse");
			return;
		}
		this.acknowledged = args;
		this.pending = undefined;
		if (args.status === ZLBFSyncStatus.OK) this.snapshots.apply(args.data.snapshot);
		print(
			`[ZLBF][MP][Client] acknowledged ${args.requestId} revision=${args.revision} status=${args.status}`
		);
	}
}
