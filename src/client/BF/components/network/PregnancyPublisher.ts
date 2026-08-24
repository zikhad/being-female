import { getPlayer, sendClientCommand } from "@asledgehammer/pipewrench";
import {
	BF_NETWORK_MODULE,
	BF_PROTOCOL_SCHEMA_VERSION,
	BFNetworkCommand,
	BFSyncStatus
} from "@constants";
import type { AuthoritativePregnancyState } from "@shared/domain/pregnancy/PregnancyState";
import { isBFSetPregnancyStateResponse, BFSetPregnancyStateRequest } from "@shared/BFProtocol";
import { SnapshotStore } from "@client/components/network/SnapshotStore";

/** Command pair used to publish one kind of Pregnancy desired state. */
type PregnancyRoute = {
	/** Client-to-server request command. */
	request: BFNetworkCommand;
	/** Correlated server-to-client response command. */
	response: BFNetworkCommand;
};

/** Desired Pregnancy state waiting to be sent after the current request completes. */
type QueuedPregnancyState = {
	/** Latest desired state, replacing any older queued state. */
	desired: AuthoritativePregnancyState;
	/** Command route appropriate to the desired state source. */
	route: PregnancyRoute;
};

/** Publishes Pregnancy desired state and correlates authoritative responses. */
export class PregnancyPublisher {
	private nextRevision = 1;
	private pending?: { payload: BFSetPregnancyStateRequest; route: PregnancyRoute };
	private queued?: QueuedPregnancyState;

	/** Creates a Pregnancy publisher backed by the shared client snapshot mirror. */
	constructor(private readonly snapshots: SnapshotStore) {}

	/** Clears connection-scoped mutation correlation and optimistic queued state. */
	public resetSession(): void {
		this.pending = undefined;
		this.queued = undefined;
	}

	/**
	 * Returns the newest in-flight or queued desired state for optimistic presentation.
	 * The authoritative mirror remains unchanged until a correlated response arrives.
	 */
	public get latestDesiredState(): AuthoritativePregnancyState | undefined {
		return this.queued?.desired ?? this.pending?.payload.data.desired;
	}

	/**
	 * Publishes a debug-only desired Pregnancy replacement.
	 *
	 * @param desired Desired reversible debug state for the authenticated player.
	 */
	public setState(desired: AuthoritativePregnancyState): void {
		this.enqueue(desired, {
			request: BFNetworkCommand.SET_PREGNANCY_STATE_REQUEST,
			response: BFNetworkCommand.SET_PREGNANCY_STATE_RESPONSE
		});
	}

	/** Publishes reversible Pregnancy progression without requiring server debug mode. */
	public publishState(desired: AuthoritativePregnancyState): void {
		this.enqueue(desired, {
			request: BFNetworkCommand.PUBLISH_PREGNANCY_STATE_REQUEST,
			response: BFNetworkCommand.PUBLISH_PREGNANCY_STATE_RESPONSE
		});
	}

	/** Coalesces desired state while preserving at most one in-flight request. */
	private enqueue(desired: AuthoritativePregnancyState, route: PregnancyRoute): void {
		if (this.pending) {
			this.queued = { desired, route };
			return;
		}
		this.send(desired, route);
	}

	/** Creates and sends one correlated Pregnancy request. */
	private send(desired: AuthoritativePregnancyState, route: PregnancyRoute): void {
		const revision = this.nextRevision++;
		const payload: BFSetPregnancyStateRequest = {
			schemaVersion: BF_PROTOCOL_SCHEMA_VERSION,
			requestId: `pregnancy-${revision}`,
			revision,
			data: { desired }
		};
		this.pending = { payload, route };
		print(
			`[BF][MP][Client] send ${route.request} request=${payload.requestId} revision=${payload.revision}`
		);
		sendClientCommand(getPlayer(), BF_NETWORK_MODULE, route.request, payload);
	}

	/**
	 * Validates and correlates a Pregnancy mutation response before updating the mirror.
	 *
	 * @param module Project Zomboid command module.
	 * @param command Command name within the module.
	 * @param args Untrusted response payload.
	 */
	public onServerCommand(module: string, command: string, args: unknown): void {
		if (module !== BF_NETWORK_MODULE || command !== this.pending?.route.response) return;
		if (!isBFSetPregnancyStateResponse(args)) return;
		const pending = this.pending;
		if (
			!pending ||
			args.requestId !== pending.payload.requestId ||
			args.revision !== pending.payload.revision ||
			args.schemaVersion !== BF_PROTOCOL_SCHEMA_VERSION
		)
			return;

		this.pending = undefined;
		const compatible =
			args.status !== BFSyncStatus.UNSUPPORTED_SCHEMA &&
			args.status !== BFSyncStatus.UNSUPPORTED_DATA_SCHEMA;
		if (compatible) {
			this.snapshots.apply(args.data.snapshot);
		}
		print(
			`[BF][MP][Client] acknowledged ${args.requestId} revision=${args.revision} status=${args.status}`
		);
		const queued = this.queued;
		this.queued = undefined;
		if (compatible && queued) this.send(queued.desired, queued.route);
	}
}
