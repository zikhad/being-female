import { IsoPlayer, sendClientCommand } from "@asledgehammer/pipewrench";
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
import { ZLBFSnapshotStore } from "@client/components/ZLBFSnapshotStore";

type PendingRequest = {
	payload: ZLBFSyncStateRequest;
	attempts: number;
};

export class ZLBFSyncPublisher {
	private static readonly MAX_ATTEMPTS = 3;
	private player?: IsoPlayer;
	private nextRevision = 1;
	private pending?: PendingRequest;
	private acknowledged?: ZLBFSyncStateResponse;

	constructor(private readonly snapshots: ZLBFSnapshotStore) {}

	public bindPlayer(player: IsoPlayer): void {
		this.player = player;
		this.pending = undefined;
		this.acknowledged = undefined;
		this.snapshots.clear();
		print("[ZLBF][MP][Client] player bound; sync deferred until minute tick");
	}

	public onEveryOneMinute(): void {
		if (!this.player || this.acknowledged) return;
		if (!this.pending) {
			const revision = this.nextRevision++;
			this.pending = {
				payload: {
					schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
					requestId: `snapshot-${revision}`,
					revision,
					data: {}
				},
				attempts: 0
			};
		}
		if (this.pending.attempts >= ZLBFSyncPublisher.MAX_ATTEMPTS) return;
		this.pending.attempts++;
		const payload = this.pending.payload;
		print(
			`[ZLBF][MP][Client] send ${ZLBFNetworkCommand.SYNC_STATE_REQUEST} request=${payload.requestId} revision=${payload.revision} attempt=${this.pending.attempts}`
		);
		sendClientCommand(
			this.player,
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.SYNC_STATE_REQUEST,
			payload
		);
	}

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
			args.requestId !== pending.payload.requestId ||
			args.revision !== pending.payload.revision ||
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
