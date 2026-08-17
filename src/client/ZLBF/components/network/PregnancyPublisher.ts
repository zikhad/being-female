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

/** Command pair used to publish one kind of Pregnancy desired state. */
type PregnancyRoute = {
	/** Client-to-server request command. */
	request: ZLBFNetworkCommand;
	/** Correlated server-to-client response command. */
	response: ZLBFNetworkCommand;
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
	private pending?: { payload: ZLBFSetPregnancyStateRequest; route: PregnancyRoute };
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
			request: ZLBFNetworkCommand.SET_PREGNANCY_STATE_REQUEST,
			response: ZLBFNetworkCommand.SET_PREGNANCY_STATE_RESPONSE
		});
	}

	/** Publishes reversible Pregnancy progression without requiring server debug mode. */
	public publishState(desired: AuthoritativePregnancyState): void {
		this.enqueue(desired, {
			request: ZLBFNetworkCommand.PUBLISH_PREGNANCY_STATE_REQUEST,
			response: ZLBFNetworkCommand.PUBLISH_PREGNANCY_STATE_RESPONSE
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
		const payload: ZLBFSetPregnancyStateRequest = {
			schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
			requestId: `pregnancy-${revision}`,
			revision,
			data: { desired }
		};
		this.pending = { payload, route };
		print(
			`[ZLBF][MP][Client] send ${route.request} request=${payload.requestId} revision=${payload.revision}`
		);
		sendClientCommand(getPlayer(), ZLBF_NETWORK_MODULE, route.request, payload);
	}

	/**
	 * Validates and correlates a Pregnancy mutation response before updating the mirror.
	 *
	 * @param module Project Zomboid command module.
	 * @param command Command name within the module.
	 * @param args Untrusted response payload.
	 */
	public onServerCommand(module: string, command: string, args: unknown): void {
		if (module !== ZLBF_NETWORK_MODULE || command !== this.pending?.route.response) return;
		if (!isZLBFSetPregnancyStateResponse(args)) return;
		const pending = this.pending;
		if (
			!pending ||
			args.requestId !== pending.payload.requestId ||
			args.revision !== pending.payload.revision ||
			args.schemaVersion !== ZLBF_PROTOCOL_SCHEMA_VERSION
		)
			return;

		this.pending = undefined;
		const compatible =
			args.status !== ZLBFSyncStatus.UNSUPPORTED_SCHEMA &&
			args.status !== ZLBFSyncStatus.UNSUPPORTED_DATA_SCHEMA;
		if (compatible) {
			this.snapshots.apply(args.data.snapshot);
		}
		print(
			`[ZLBF][MP][Client] acknowledged ${args.requestId} revision=${args.revision} status=${args.status}`
		);
		const queued = this.queued;
		this.queued = undefined;
		if (compatible && queued) this.send(queued.desired, queued.route);
	}
}
