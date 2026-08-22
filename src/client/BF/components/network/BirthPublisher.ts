import { getPlayer, sendClientCommand } from "@asledgehammer/pipewrench";
import {
	BF_NETWORK_MODULE,
	BF_PROTOCOL_SCHEMA_VERSION,
	BFNetworkCommand,
	BFSyncStatus
} from "@constants";
import {
	isBFAllocateBirthResponse,
	isBFCompleteBirthResponse,
	BFAllocateBirthRequest,
	BFCompleteBirthRequest
} from "@shared/BFProtocol";
import { SnapshotStore } from "@client/components/network/SnapshotStore";

/** Requests and correlates one server-owned birth operation allocation. */
export class BirthPublisher {
	private nextRevision = 1;
	private pending?: BFAllocateBirthRequest;
	private completion?: BFCompleteBirthRequest;

	/** Creates a birth publisher backed by the shared authoritative snapshot mirror. */
	constructor(private readonly snapshots: SnapshotStore) {
		this.snapshots.subscribe(snapshot => {
			const completion = this.completion;
			if (completion && snapshot.domains.birth.completedBirthId === completion.data.birthId) {
				this.completion = undefined;
			}
		});
	}

	/** Discards connection-scoped allocation and completion correlation. */
	public resetSession(): void {
		this.pending = undefined;
		this.completion = undefined;
	}

	/** Retries the exact retained completion envelope once per in-game minute. */
	public onEveryOneMinute(): void {
		if (this.completion) this.sendCompletion(this.completion);
	}

	/** Requests allocation unless an operation is already pending locally or authoritatively. */
	public allocate(): void {
		if (this.pending || this.snapshots.snapshot?.domains.birth.pendingBirthId) return;

		const revision = this.nextRevision++;
		const payload: BFAllocateBirthRequest = {
			schemaVersion: BF_PROTOCOL_SCHEMA_VERSION,
			requestId: `birth-allocation-${revision}`,
			revision,
			data: {}
		};
		this.pending = payload;
		print(
			`[BF][MP][Client] send ${BFNetworkCommand.ALLOCATE_BIRTH_REQUEST} request=${payload.requestId} revision=${payload.revision}`
		);
		sendClientCommand(
			getPlayer(),
			BF_NETWORK_MODULE,
			BFNetworkCommand.ALLOCATE_BIRTH_REQUEST,
			payload
		);
	}

	/** Sends completion for the currently pending server-issued birth identity. */
	public complete(birthId: string): void {
		if (this.completion) return;
		const revision = this.nextRevision++;
		const payload: BFCompleteBirthRequest = {
			schemaVersion: BF_PROTOCOL_SCHEMA_VERSION,
			requestId: `birth-completion-${revision}`,
			revision,
			data: { birthId }
		};
		this.completion = payload;
		this.sendCompletion(payload);
	}

	/** Sends a retained completion request without changing its correlation metadata. */
	private sendCompletion(payload: BFCompleteBirthRequest): void {
		const birthId = payload.data.birthId;
		print(`[BF][MP][Client] send CompleteBirthRequest birthId=${birthId}`);
		sendClientCommand(
			getPlayer(),
			BF_NETWORK_MODULE,
			BFNetworkCommand.COMPLETE_BIRTH_REQUEST,
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
		if (module === BF_NETWORK_MODULE && command === BFNetworkCommand.COMPLETE_BIRTH_RESPONSE) {
			this.onCompletion(args);
			return;
		}
		if (module !== BF_NETWORK_MODULE || command !== BFNetworkCommand.ALLOCATE_BIRTH_RESPONSE)
			return;
		if (!isBFAllocateBirthResponse(args)) {
			print("[BF][MP][Client] ignored malformed AllocateBirthResponse");
			return;
		}
		const pending = this.pending;
		if (
			!pending ||
			args.requestId !== pending.requestId ||
			args.revision !== pending.revision ||
			args.schemaVersion !== BF_PROTOCOL_SCHEMA_VERSION
		) {
			print("[BF][MP][Client] ignored uncorrelated AllocateBirthResponse");
			return;
		}

		this.pending = undefined;
		if (args.status === BFSyncStatus.OK) this.snapshots.apply(args.data.snapshot);
		const birthId = args.data.snapshot.domains.birth.pendingBirthId ?? "none";
		print(
			`[BF][MP][Client] acknowledged ${args.requestId} status=${args.status} pendingBirthId=${birthId}`
		);
	}

	/** Applies one correlated birth-completion response. */
	private onCompletion(args: unknown): void {
		if (!isBFCompleteBirthResponse(args)) return;
		const completion = this.completion;
		if (
			!completion ||
			args.requestId !== completion.requestId ||
			args.revision !== completion.revision ||
			args.schemaVersion !== BF_PROTOCOL_SCHEMA_VERSION
		)
			return;
		const compatible =
			args.status !== BFSyncStatus.UNSUPPORTED_SCHEMA &&
			args.status !== BFSyncStatus.UNSUPPORTED_DATA_SCHEMA;
		if (!compatible) return;
		const stillPending =
			args.data.snapshot.domains.birth.pendingBirthId === completion.data.birthId;
		if (!stillPending) this.completion = undefined;
		const current = this.snapshots.snapshot;
		this.snapshots.apply(args.data.snapshot);
		if (current && current.stateVersion === args.data.snapshot.stateVersion) {
			this.snapshots.notifyCurrent();
		}
		print(
			`[BF][MP][Client] acknowledged CompleteBirthResponse status=${args.status} birthId=${completion.data.birthId}`
		);
	}
}
