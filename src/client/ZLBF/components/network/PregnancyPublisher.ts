import { getPlayer, sendClientCommand } from "@asledgehammer/pipewrench";
import {
	ZLBF_NETWORK_MODULE,
	ZLBF_PROTOCOL_SCHEMA_VERSION,
	ZLBFNetworkCommand,
	ZLBFSyncStatus
} from "@constants";
import type { AuthoritativePregnancyState } from "@shared/domain/pregnancy/PregnancyState";
import {
	isZLBFSetPregnancyStateResponse,
	ZLBFSetPregnancyStateRequest
} from "@shared/ZLBFProtocol";
import { SnapshotStore } from "@client/components/network/SnapshotStore";

/** Publishes debug Pregnancy intents and correlates their authoritative responses. */
export class PregnancyPublisher {
	private nextRevision = 1;
	private pending?: ZLBFSetPregnancyStateRequest;

	/** Creates a Pregnancy publisher backed by the shared client snapshot mirror. */
	constructor(private readonly snapshots: SnapshotStore) {}

	/**
	 * Sends one desired Pregnancy state when no mutation is already pending.
	 *
	 * @param desired Desired reversible debug state for the authenticated player.
	 */
	public setState(desired: AuthoritativePregnancyState): void {
		if (this.pending) return;

		const revision = this.nextRevision++;
		const payload: ZLBFSetPregnancyStateRequest = {
			schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
			requestId: `pregnancy-${revision}`,
			revision,
			data: { desired }
		};
		this.pending = payload;
		print(
			`[ZLBF][MP][Client] send ${ZLBFNetworkCommand.SET_PREGNANCY_STATE_REQUEST} request=${payload.requestId} revision=${payload.revision}`
		);
		sendClientCommand(
			getPlayer(),
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.SET_PREGNANCY_STATE_REQUEST,
			payload
		);
	}

	/**
	 * Validates and correlates a Pregnancy mutation response before updating the mirror.
	 *
	 * @param module Project Zomboid command module.
	 * @param command Command name within the module.
	 * @param args Untrusted response payload.
	 */
	public onServerCommand(module: string, command: string, args: unknown): void {
		if (
			module !== ZLBF_NETWORK_MODULE ||
			command !== ZLBFNetworkCommand.SET_PREGNANCY_STATE_RESPONSE
		)
			return;
		if (!isZLBFSetPregnancyStateResponse(args)) return;
		if (
			!this.pending ||
			args.requestId !== this.pending.requestId ||
			args.revision !== this.pending.revision ||
			args.schemaVersion !== ZLBF_PROTOCOL_SCHEMA_VERSION
		)
			return;

		this.pending = undefined;
		if (
			args.status !== ZLBFSyncStatus.UNSUPPORTED_SCHEMA &&
			args.status !== ZLBFSyncStatus.UNSUPPORTED_DATA_SCHEMA
		) {
			this.snapshots.apply(args.data.snapshot);
		}
		print(
			`[ZLBF][MP][Client] acknowledged ${args.requestId} revision=${args.revision} status=${args.status}`
		);
	}
}
