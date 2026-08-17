import { getPlayer, sendClientCommand } from "@asledgehammer/pipewrench";
import {
	ZLBF_NETWORK_MODULE,
	ZLBF_PROTOCOL_SCHEMA_VERSION,
	ZLBFNetworkCommand,
	ZLBFSyncStatus
} from "@constants";
import { isZLBFPublishWombStateResponse, ZLBFPublishWombStateRequest } from "@shared/ZLBFProtocol";
import type { WombProgressState } from "@shared/domain/womb/WombState";
import { SnapshotStore } from "@client/components/network/SnapshotStore";

/** Publishes reversible Womb contents and cycle progression and applies responses. */
export class WombPublisher {
	private nextRevision = 1;
	private pending?: ZLBFPublishWombStateRequest;
	private queued?: WombProgressState;

	/** Creates a Womb publisher backed by the shared snapshot mirror. */
	constructor(private readonly snapshots: SnapshotStore) {}

	/** Returns the newest queued or in-flight desired state for optimistic presentation. */
	public get latestDesiredState(): WombProgressState | undefined {
		return this.queued ?? this.pending?.data.desired;
	}

	/** Publishes or coalesces the latest concrete reversible Womb state. */
	public publishState(desired: WombProgressState): void {
		if (this.pending) {
			this.queued = desired;
			return;
		}
		this.send(desired);
	}

	/**
	 * Creates and sends one correlated Womb-state request based on the current snapshot version.
	 *
	 * @param desired Complete client-simulated state calculated from the current mirror.
	 */
	private send(desired: WombProgressState): void {
		const revision = this.nextRevision++;
		const payload: ZLBFPublishWombStateRequest = {
			schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
			requestId: `womb-${revision}`,
			revision,
			baseStateVersion: this.snapshots.snapshot?.stateVersion ?? 0,
			data: { desired }
		};
		this.pending = payload;
		print(
			`[ZLBF][MP][Client] send PublishWombStateRequest cycleDay=${desired.cycleDay} amount=${desired.amount} total=${desired.total}`
		);
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
			`[ZLBF][MP][Client] acknowledged PublishWombStateResponse status=${args.status} cycleDay=${args.data.snapshot.domains.womb.cycleDay} amount=${args.data.snapshot.domains.womb.amount} total=${args.data.snapshot.domains.womb.total}`
		);
		const queued = this.queued;
		this.queued = undefined;
		if (compatible) {
			const authoritative = args.data.snapshot.domains.womb;
			const desired = queued ?? pending.data.desired;
			const reconciled =
				desired.cycleDay === authoritative.cycleDay &&
				authoritative.onContraceptive !== undefined
					? { ...desired, onContraceptive: authoritative.onContraceptive }
					: desired;
			const unapplied =
				(authoritative.cycleDay !== undefined &&
					authoritative.cycleDay !== reconciled.cycleDay) ||
				(authoritative.amount !== undefined &&
					authoritative.amount !== reconciled.amount) ||
				(authoritative.total !== undefined && authoritative.total !== reconciled.total) ||
				(authoritative.onContraceptive !== undefined &&
					authoritative.onContraceptive !== reconciled.onContraceptive);
			if (unapplied) this.send(reconciled);
		}
	}
}
