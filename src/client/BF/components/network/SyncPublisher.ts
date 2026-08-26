import { getPlayer, sendClientCommand } from "@asledgehammer/pipewrench";
import {
	BF_NETWORK_MODULE,
	BF_PROTOCOL_SCHEMA_VERSION,
	BFNetworkCommand,
	BFSyncStatus
} from "@constants";
import { isBFSyncStateResponse, BFSyncStateRequest, BFSyncStateResponse } from "@shared/BFProtocol";
import { SnapshotStore } from "@client/components/network/SnapshotStore";

/**
 * Publishes one read-only snapshot request and accepts its correlated server response.
 *
 * The first send is deferred until `EveryOneMinute`, where runtime testing established
 * that `getPlayer()` is available. Connection resets discard correlation so the next
 * minute performs a fresh bootstrap rather than sending from a lifecycle callback.
 */
export class SyncPublisher {
	private nextRevision = 1;
	private pending?: BFSyncStateRequest;
	private acknowledged?: BFSyncStateResponse;

	/**
	 * Creates a publisher backed by the client-side authoritative snapshot mirror.
	 *
	 * @param snapshots Store updated after a valid successful response is acknowledged.
	 */
	constructor(private readonly snapshots: SnapshotStore) {}

	/** Discards transport correlation and permits a fresh minute-deferred bootstrap. */
	public resetSession(): void {
		this.pending = undefined;
		this.acknowledged = undefined;
	}

	/** Sends the initial snapshot request on the first eligible in-game minute tick. */
	public onEveryOneMinute(): void {
		if (this.pending || this.acknowledged) return;

		const player = getPlayer();
		const revision = this.nextRevision++;
		const payload: BFSyncStateRequest = {
			schemaVersion: BF_PROTOCOL_SCHEMA_VERSION,
			requestId: `snapshot-${revision}`,
			revision,
			data: {}
		};
		this.pending = payload;

		print(
			`[BF][MP][Client] send ${BFNetworkCommand.SYNC_STATE_REQUEST} request=${payload.requestId} revision=${payload.revision}`
		);
		sendClientCommand(player, BF_NETWORK_MODULE, BFNetworkCommand.SYNC_STATE_REQUEST, payload);
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
		if (module !== BF_NETWORK_MODULE || command !== BFNetworkCommand.SYNC_STATE_RESPONSE)
			return;
		if (!isBFSyncStateResponse(args)) {
			print("[BF][MP][Client] ignored malformed SyncStateResponse");
			return;
		}
		const pending = this.pending;
		if (
			!pending ||
			args.requestId !== pending.requestId ||
			args.revision !== pending.revision ||
			args.schemaVersion !== BF_PROTOCOL_SCHEMA_VERSION
		) {
			print("[BF][MP][Client] ignored uncorrelated SyncStateResponse");
			return;
		}
		this.acknowledged = args;
		this.pending = undefined;
		if (args.status === BFSyncStatus.OK) this.snapshots.apply(args.data.snapshot);
		print(
			`[BF][MP][Client] acknowledged ${args.requestId} revision=${args.revision} status=${args.status}`
		);
	}
}
