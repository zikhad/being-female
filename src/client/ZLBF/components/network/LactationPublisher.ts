import { getPlayer, sendClientCommand } from "@asledgehammer/pipewrench";
import {
	ZLBF_NETWORK_MODULE,
	ZLBF_PROTOCOL_SCHEMA_VERSION,
	ZLBFNetworkCommand,
	ZLBFSyncStatus
} from "@constants";
import type { LactationState } from "@shared/domain/lactation/LactationState";
import {
	isZLBFPublishLactationStateResponse,
	ZLBFPublishLactationStateRequest
} from "@shared/ZLBFProtocol";
import { SnapshotStore } from "@client/components/network/SnapshotStore";

/** Explicit merge operation for one numeric Lactation field. */
export type LactationNumericIntent =
	| { mode: "delta"; value: number }
	| { mode: "replace"; value: number };

/** Typed semantics describing how one complete optimistic state should merge after conflict. */
export type LactationMutationIntent = {
	isActive?: { mode: "replace"; value: boolean };
	milkAmount?: LactationNumericIntent;
	expiration?: LactationNumericIntent;
	multiplier?: LactationNumericIntent;
};

type OptimisticLactation = { desired: LactationState; intent: LactationMutationIntent };

/** Publishes complete Lactation simulation and explicitly rebases conflicts onto recipe state. */
export class LactationPublisher {
	private nextRevision = 1;
	private pending?: {
		request: ZLBFPublishLactationStateRequest;
		intent: LactationMutationIntent;
	};
	private queued?: OptimisticLactation;
	private pendingMinutes = 0;
	private readonly retryMinutes = 2;

	/** Creates a publisher backed by the common authoritative snapshot mirror. */
	constructor(private readonly snapshots: SnapshotStore) {}

	/** Returns the newest optimistic state awaiting authoritative convergence. */
	public get latestDesiredState(): LactationState | undefined {
		return this.queued?.desired ?? this.pending?.request.data.desired;
	}

	/** Publishes or coalesces complete state with explicit per-field merge semantics. */
	public publishState(
		desired: LactationState,
		intent: LactationMutationIntent = replacementsFor(desired)
	): void {
		if (this.pending) {
			this.queued = {
				desired,
				intent: composeLactationIntent(this.queued?.intent, intent, desired)
			};
			return;
		}
		this.send(desired, intent);
	}

	/** Retries the same correlated request after a bounded number of minute ticks. */
	public onEveryOneMinute(): void {
		if (!this.pending) return;
		this.pendingMinutes += 1;
		if (this.pendingMinutes < this.retryMinutes) return;
		this.pendingMinutes = 0;
		this.sendRequest(this.pending.request);
	}

	/** Creates and sends one versioned request while retaining its typed merge intent. */
	private send(desired: LactationState, intent: LactationMutationIntent): void {
		const revision = this.nextRevision++;
		const request: ZLBFPublishLactationStateRequest = {
			schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
			requestId: `lactation-${revision}`,
			revision,
			baseStateVersion: this.snapshots.snapshot?.stateVersion ?? 0,
			data: { desired }
		};
		this.pending = { request, intent };
		this.pendingMinutes = 0;
		this.sendRequest(request);
	}

	/** Sends an existing correlated request without replacing queued optimistic state. */
	private sendRequest(request: ZLBFPublishLactationStateRequest): void {
		const desired = request.data.desired;
		print(
			`[ZLBF][MP][Client] send PublishLactationStateRequest active=${desired.isActive} milk=${desired.milkAmount} expiration=${desired.expiration} multiplier=${desired.multiplier}`
		);
		sendClientCommand(
			getPlayer(),
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.PUBLISH_LACTATION_STATE_REQUEST,
			request
		);
	}

	/** Applies a correlated response and explicitly rebases typed simulation intent. */
	public onServerCommand(module: string, command: string, args: unknown): void {
		if (
			module !== ZLBF_NETWORK_MODULE ||
			command !== ZLBFNetworkCommand.PUBLISH_LACTATION_STATE_RESPONSE ||
			!isZLBFPublishLactationStateResponse(args) ||
			args.schemaVersion !== ZLBF_PROTOCOL_SCHEMA_VERSION
		)
			return;
		const pending = this.pending;
		if (
			!pending ||
			args.requestId !== pending.request.requestId ||
			args.revision !== pending.request.revision
		)
			return;
		this.pending = undefined;
		this.pendingMinutes = 0;
		const compatible =
			args.status !== ZLBFSyncStatus.UNSUPPORTED_SCHEMA &&
			args.status !== ZLBFSyncStatus.UNSUPPORTED_DATA_SCHEMA;
		if (!compatible) {
			this.queued = undefined;
			return;
		}
		this.snapshots.apply(args.data.snapshot);
		const authoritative = args.data.snapshot.domains.lactation;
		const queued = this.queued;
		const optimistic = queued ?? {
			desired: pending.request.data.desired,
			intent: pending.intent
		};
		this.queued = undefined;
		const pendingAccepted = sameLactation(authoritative, pending.request.data.desired);
		const replayIntent = pendingAccepted
			? queued?.intent ?? {}
			: queued
				? composeLactationIntent(pending.intent, queued.intent, queued.desired)
				: pending.intent;
		const accepted = sameLactation(authoritative, optimistic.desired);
		print(
			`[ZLBF][MP][Client] acknowledged PublishLactationStateResponse status=${args.status} active=${authoritative.isActive} milk=${authoritative.milkAmount} expiration=${authoritative.expiration} multiplier=${authoritative.multiplier}`
		);
		if (accepted) {
			this.snapshots.notifyCurrent();
			return;
		}
		const rebased = rebaseLactationState(replayIntent, authoritative);
		if (sameLactation(rebased, authoritative)) {
			this.snapshots.notifyCurrent();
			return;
		}
		this.send(rebased, replacementsFor(rebased));
	}
}

/**
 * Composes sequential queued intent without inferring semantics from numeric differences.
 * A replacement supersedes prior work; a delta after replacement adjusts the replacement
 * to the latest complete desired value; consecutive deltas accumulate.
 *
 * @param current Already-coalesced intent from the pending desired to the prior queued state.
 * @param next Explicit intent for the newest local mutation.
 * @param desired Complete state after applying `next`, used when adjusting a replacement.
 * @returns Intent representing the whole queued mutation sequence.
 */
export const composeLactationIntent = (
	current: LactationMutationIntent | undefined,
	next: LactationMutationIntent,
	desired: LactationState
): LactationMutationIntent => {
	const compose = (
		previous: LactationNumericIntent | undefined,
		following: LactationNumericIntent | undefined,
		value: number
	): LactationNumericIntent | undefined => {
		if (!following) return previous;
		if (following.mode === "replace") return following;
		if (previous?.mode === "replace") return { mode: "replace", value };
		return { mode: "delta", value: (previous?.value ?? 0) + following.value };
	};
	return {
		isActive: next.isActive ?? current?.isActive,
		milkAmount: compose(current?.milkAmount, next.milkAmount, desired.milkAmount),
		expiration: compose(current?.expiration, next.expiration, desired.expiration),
		multiplier: compose(current?.multiplier, next.multiplier, desired.multiplier)
	};
};

/**
 * Applies typed replacement/delta intent over authoritative recipe-owned state.
 *
 * @param intent Explicit per-field mutation semantics supplied by the simulation component.
 * @param authoritative Latest server-owned state, potentially changed by a recipe.
 * @returns Complete rebased state with numeric values clamped at zero.
 */
export const rebaseLactationState = (
	intent: LactationMutationIntent,
	authoritative: LactationState
): LactationState => {
	const numeric = (operation: LactationNumericIntent | undefined, current: number): number =>
		!operation
			? current
			: Math.max(
					0,
					operation.mode === "replace" ? operation.value : current + operation.value
				);
	return {
		isActive: intent.isActive?.value ?? authoritative.isActive,
		milkAmount: numeric(intent.milkAmount, authoritative.milkAmount),
		expiration: numeric(intent.expiration, authoritative.expiration),
		multiplier: numeric(intent.multiplier, authoritative.multiplier)
	};
};

/** Returns whether two complete Lactation states are field-equivalent. */
const sameLactation = (left: LactationState, right: LactationState): boolean =>
	left.isActive === right.isActive &&
	left.milkAmount === right.milkAmount &&
	left.expiration === right.expiration &&
	left.multiplier === right.multiplier;
/** Creates explicit full-replacement intent for an already rebased state. */
const replacementsFor = (state: LactationState): LactationMutationIntent => ({
	isActive: { mode: "replace", value: state.isActive },
	milkAmount: { mode: "replace", value: state.milkAmount },
	expiration: { mode: "replace", value: state.expiration },
	multiplier: { mode: "replace", value: state.multiplier }
});
