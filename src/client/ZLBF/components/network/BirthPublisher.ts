import { getPlayer, sendClientCommand } from "@asledgehammer/pipewrench";
import {
	ZLBF_NETWORK_MODULE,
	ZLBF_PROTOCOL_SCHEMA_VERSION,
	ZLBFNetworkCommand,
	ZLBFSyncStatus
} from "@constants";
import {
	isZLBFAllocateBirthResponse,
	isZLBFCompleteBirthResponse,
	ZLBFAllocateBirthRequest,
	ZLBFCompleteBirthRequest
} from "@shared/ZLBFProtocol";
import { SnapshotStore } from "@client/components/network/SnapshotStore";

/** Requests and correlates one server-owned birth operation allocation. */
export class BirthPublisher {
	private nextRevision = 1;
	private pending?: ZLBFAllocateBirthRequest;
	private completion?: ZLBFCompleteBirthRequest;

	/** Creates a birth publisher backed by the shared authoritative snapshot mirror. */
	constructor(private readonly snapshots: SnapshotStore) {}

	/** Requests allocation unless an operation is already pending locally or authoritatively. */
	public allocate(): void {
		if (this.pending || this.snapshots.snapshot?.domains.birth.pendingBirthId) return;

		const revision = this.nextRevision++;
		const payload: ZLBFAllocateBirthRequest = {
			schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
			requestId: `birth-allocation-${revision}`,
			revision,
			data: {}
		};
		this.pending = payload;
		print(
			`[ZLBF][MP][Client] send ${ZLBFNetworkCommand.ALLOCATE_BIRTH_REQUEST} request=${payload.requestId} revision=${payload.revision}`
		);
		sendClientCommand(
			getPlayer(),
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.ALLOCATE_BIRTH_REQUEST,
			payload
		);
	}

	/** Sends completion for the currently pending server-issued birth identity. */
	public complete(birthId: string): void {
		if (this.completion) return;
		const revision = this.nextRevision++;
		const payload: ZLBFCompleteBirthRequest = {
			schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
			requestId: `birth-completion-${revision}`,
			revision,
			data: { birthId }
		};
		this.completion = payload;
		print(`[ZLBF][MP][Client] send CompleteBirthRequest birthId=${birthId}`);
		sendClientCommand(
			getPlayer(),
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.COMPLETE_BIRTH_REQUEST,
			payload
		);
	}

	/**
	 * Applies an exactly correlated allocation response and logs its authoritative identity.
	 *
	 * @param module Project Zomboid command module.
	 * @param command Command name within the module.
	 * @param args Untrusted response payload.
	 */
	public onServerCommand(module: string, command: string, args: unknown): void {
		if (
			module === ZLBF_NETWORK_MODULE &&
			command === ZLBFNetworkCommand.COMPLETE_BIRTH_RESPONSE
		) {
			this.onCompletion(args);
			return;
		}
		if (
			module !== ZLBF_NETWORK_MODULE ||
			command !== ZLBFNetworkCommand.ALLOCATE_BIRTH_RESPONSE
		)
			return;
		if (!isZLBFAllocateBirthResponse(args)) {
			print("[ZLBF][MP][Client] ignored malformed AllocateBirthResponse");
			return;
		}
		const pending = this.pending;
		if (
			!pending ||
			args.requestId !== pending.requestId ||
			args.revision !== pending.revision ||
			args.schemaVersion !== ZLBF_PROTOCOL_SCHEMA_VERSION
		) {
			print("[ZLBF][MP][Client] ignored uncorrelated AllocateBirthResponse");
			return;
		}

		this.pending = undefined;
		if (args.status === ZLBFSyncStatus.OK) this.snapshots.apply(args.data.snapshot);
		const birthId = args.data.snapshot.domains.birth.pendingBirthId ?? "none";
		print(
			`[ZLBF][MP][Client] acknowledged ${args.requestId} status=${args.status} pendingBirthId=${birthId}`
		);
	}

	/** Applies one correlated birth-completion response. */
	private onCompletion(args: unknown): void {
		if (!isZLBFCompleteBirthResponse(args)) return;
		const completion = this.completion;
		if (
			!completion ||
			args.requestId !== completion.requestId ||
			args.revision !== completion.revision
		)
			return;
		this.completion = undefined;
		if (args.status === ZLBFSyncStatus.OK) this.snapshots.apply(args.data.snapshot);
		print(
			`[ZLBF][MP][Client] acknowledged CompleteBirthResponse status=${args.status} birthId=${completion.data.birthId}`
		);
	}
}
