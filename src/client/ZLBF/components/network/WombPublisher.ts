import { getPlayer, sendClientCommand } from "@asledgehammer/pipewrench";
import {
	ZLBF_NETWORK_MODULE,
	ZLBF_PROTOCOL_SCHEMA_VERSION,
	ZLBFNetworkCommand,
	ZLBFSyncStatus
} from "@constants";
import { isZLBFPublishWombStateResponse, ZLBFPublishWombStateRequest } from "@shared/ZLBFProtocol";
import type { WombCycleState } from "@shared/domain/womb/WombState";
import { SnapshotStore } from "@client/components/network/SnapshotStore";

/** Publishes reversible Womb cycle progression and applies authoritative responses. */
export class WombPublisher {
	private nextRevision = 1;
	private pending?: ZLBFPublishWombStateRequest;
	private queued?: WombCycleState;

	/** Creates a Womb publisher backed by the shared snapshot mirror. */
	constructor(private readonly snapshots: SnapshotStore) {
		this.snapshots.subscribe(() => this.releasePendingAfterSnapshot());
	}

	/** Releases an unanswered request after a newer authoritative sync and sends queued state. */
	private releasePendingAfterSnapshot(): void {
		if (!this.pending) return;
		this.pending = undefined;
		const queued = this.queued;
		this.queued = undefined;
		if (queued) this.send(queued);
	}

	/** Publishes or coalesces the latest concrete menstrual-cycle state. */
	public publishState(desired: WombCycleState): void {
		if (this.pending) {
			this.queued = desired;
			return;
		}
		this.send(desired);
	}

	/** Creates and sends one correlated Womb progression request. */
	private send(desired: WombCycleState): void {
		const revision = this.nextRevision++;
		const payload: ZLBFPublishWombStateRequest = {
			schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
			requestId: `womb-${revision}`,
			revision,
			data: { desired }
		};
		this.pending = payload;
		print(`[ZLBF][MP][Client] send PublishWombStateRequest cycleDay=${desired.cycleDay}`);
		sendClientCommand(
			getPlayer(),
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.PUBLISH_WOMB_STATE_REQUEST,
			payload
		);
	}

	/** Routes a correlated Womb response and sends any coalesced state afterward. */
	public onServerCommand(module: string, command: string, args: unknown): void {
		if (
			module !== ZLBF_NETWORK_MODULE ||
			command !== ZLBFNetworkCommand.PUBLISH_WOMB_STATE_RESPONSE ||
			!isZLBFPublishWombStateResponse(args) ||
			args.schemaVersion !== ZLBF_PROTOCOL_SCHEMA_VERSION
		)
			return;
		const pending = this.pending;
		if (!pending || args.requestId !== pending.requestId || args.revision !== pending.revision)
			return;
		this.pending = undefined;
		const compatible =
			args.status !== ZLBFSyncStatus.UNSUPPORTED_SCHEMA &&
			args.status !== ZLBFSyncStatus.UNSUPPORTED_DATA_SCHEMA;
		if (compatible) this.snapshots.apply(args.data.snapshot);
		print(
			`[ZLBF][MP][Client] acknowledged PublishWombStateResponse status=${args.status} cycleDay=${args.data.snapshot.domains.womb.cycleDay}`
		);
		const queued = this.queued;
		this.queued = undefined;
		if (compatible && queued) this.send(queued);
	}
}
