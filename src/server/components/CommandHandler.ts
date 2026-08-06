import { IsoPlayer, isDebugEnabled, sendServerCommand } from "@asledgehammer/pipewrench";
import {
	ZLBF_DATA_SCHEMA_VERSION,
	ZLBF_NETWORK_MODULE,
	ZLBF_PROTOCOL_SCHEMA_VERSION,
	ZLBFTraitsEnum,
	ZLBFNetworkCommand,
	ZLBFSyncStatus
} from "@constants";
import {
	isZLBFSetPregnancyStateRequest,
	isZLBFSyncStateRequest,
	ZLBFSetPregnancyStateRequest,
	ZLBFSnapshot,
	ZLBFSyncStateResponse
} from "@shared/ZLBFProtocol";
import { StateRepository } from "@server/components/state/StateRepository";
import { StateLoadResult } from "@server/components/state/AuthoritativeState";
import { PregnancyReconciler } from "@shared/domain/pregnancy/PregnancyReconciler";
import {
	createDefaultPregnancyState,
	PregnancyStatus
} from "@shared/domain/pregnancy/PregnancyState";
import { CharacterTraitApi } from "@shared/components/CharacterTraitApi";

/** Validates and handles ZLBF commands received in the server execution context. */
export class CommandHandler {
	/** Creates a handler backed by the server-owned player-state repository. */
	constructor(
		private readonly states = new StateRepository(),
		private readonly pregnancy = new PregnancyReconciler()
	) {}

	/**
	 * Routes a read-only snapshot request and replies directly to its authenticated player.
	 * The event-supplied player is authoritative; payload data is never used to select a player.
	 *
	 * @param module Project Zomboid command module.
	 * @param command Command name within the module.
	 * @param player Authenticated player supplied by `OnClientCommand`.
	 * @param args Untrusted command payload supplied by Project Zomboid.
	 */
	public onClientCommand(
		module: string,
		command: string,
		player: IsoPlayer | undefined,
		args: unknown
	): void {
		if (module !== ZLBF_NETWORK_MODULE) return;
		if (!player) {
			print(`[ZLBF][MP][Server] ignored ${command} before player binding`);
			return;
		}
		if (command === ZLBFNetworkCommand.SYNC_STATE_REQUEST) {
			this.syncState(player, args);
			return;
		}
		if (command === ZLBFNetworkCommand.SET_PREGNANCY_STATE_REQUEST) {
			this.setPregnancyState(player, args);
		}
	}

	/** Handles a validated read-only authoritative snapshot request. */
	private syncState(player: IsoPlayer, args: unknown): void {
		if (!isZLBFSyncStateRequest(args)) {
			print(`[ZLBF][MP][Server] rejected malformed request from ${player.getUsername()}`);
			return;
		}

		const state = this.loadForProtocol(player, args.schemaVersion);
		const status = this.loadStatus(args.schemaVersion, state);
		if (status === ZLBFSyncStatus.OK && state?.supported) {
			this.applyPregnancyTrait(player, state.state.domains.pregnancy.status);
		}
		this.sendSnapshot(player, ZLBFNetworkCommand.SYNC_STATE_RESPONSE, args, status, state);
	}

	/** Handles a debug-only reversible Pregnancy state mutation. */
	private setPregnancyState(player: IsoPlayer, args: unknown): void {
		if (!isZLBFSetPregnancyStateRequest(args)) {
			print(
				`[ZLBF][MP][Server] rejected malformed Pregnancy request from ${player.getUsername()}`
			);
			return;
		}

		const loaded = this.loadForProtocol(player, args.schemaVersion);
		let status = this.loadStatus(args.schemaVersion, loaded);
		if (status === ZLBFSyncStatus.OK && !isDebugEnabled()) status = ZLBFSyncStatus.FORBIDDEN;

		if (status === ZLBFSyncStatus.OK && loaded?.supported) {
			const reconciliation = this.pregnancy.reconcile(
				loaded.state.domains.pregnancy,
				args.data.desired
			);
			if (!reconciliation.valid) {
				status = ZLBFSyncStatus.INVALID_REQUEST;
			} else {
				if (reconciliation.changed) {
					loaded.state.domains.pregnancy = reconciliation.state;
					loaded.state.stateVersion += 1;
					loaded.stateVersion = loaded.state.stateVersion;
					this.states.save(player, loaded.state);
				}
				this.applyPregnancyTrait(player, reconciliation.state.status);
			}
		}

		this.sendSnapshot(
			player,
			ZLBFNetworkCommand.SET_PREGNANCY_STATE_RESPONSE,
			args,
			status,
			loaded
		);
	}

	/** Loads persisted state only when the request uses the supported wire schema. */
	private loadForProtocol(player: IsoPlayer, schemaVersion: number): StateLoadResult | undefined {
		return schemaVersion === ZLBF_PROTOCOL_SCHEMA_VERSION
			? this.states.load(player)
			: undefined;
	}

	/** Maps protocol and persistence compatibility to a response status. */
	private loadStatus(schemaVersion: number, state?: StateLoadResult): ZLBFSyncStatus {
		if (schemaVersion !== ZLBF_PROTOCOL_SCHEMA_VERSION)
			return ZLBFSyncStatus.UNSUPPORTED_SCHEMA;
		return state?.supported ? ZLBFSyncStatus.OK : ZLBFSyncStatus.UNSUPPORTED_DATA_SCHEMA;
	}

	/** Reconciles the server-owned compatibility trait with authoritative Pregnancy status. */
	private applyPregnancyTrait(player: IsoPlayer, status: PregnancyStatus): void {
		if (status === PregnancyStatus.PREGNANT) {
			CharacterTraitApi.addTrait(player, ZLBFTraitsEnum.PREGNANCY);
			return;
		}
		CharacterTraitApi.removeTrait(player, ZLBFTraitsEnum.PREGNANCY);
	}

	/** Creates client-visible snapshot data without exposing mutable server storage. */
	private snapshot(state?: StateLoadResult): ZLBFSnapshot {
		return {
			dataSchemaVersion: state?.dataSchemaVersion ?? ZLBF_DATA_SCHEMA_VERSION,
			stateVersion: state?.stateVersion ?? 0,
			domains: {
				pregnancy: state?.supported
					? state.state.domains.pregnancy
					: createDefaultPregnancyState()
			}
		};
	}

	/** Sends a targeted correlated response containing the authoritative snapshot. */
	private sendSnapshot(
		player: IsoPlayer,
		command: ZLBFNetworkCommand,
		request: Pick<ZLBFSetPregnancyStateRequest, "requestId" | "revision">,
		status: ZLBFSyncStatus,
		state?: StateLoadResult
	): void {
		const response: ZLBFSyncStateResponse = {
			schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
			requestId: request.requestId,
			revision: request.revision,
			status,
			data: { snapshot: this.snapshot(state) }
		};
		print(
			`[ZLBF][MP][Server] reply ${response.requestId} revision=${response.revision} status=${response.status}`
		);
		sendServerCommand(player, ZLBF_NETWORK_MODULE, command, response);
	}
}
