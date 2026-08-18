import {
	IsoPlayer,
	isDebugEnabled,
	sendServerCommand,
	instanceItem
} from "@asledgehammer/pipewrench";
import {
	ZLBF_DATA_SCHEMA_VERSION,
	ZLBF_NETWORK_MODULE,
	ZLBF_PROTOCOL_SCHEMA_VERSION,
	ITEMS,
	ZLBFTraitsEnum,
	ZLBFNetworkCommand,
	ZLBFSyncStatus
} from "@constants";
import {
	isZLBFSetPregnancyStateRequest,
	isZLBFAllocateBirthRequest,
	isZLBFCompleteBirthRequest,
	isZLBFPublishWombStateRequest,
	isZLBFPublishLactationStateRequest,
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
import { createDefaultBirthState } from "@shared/domain/birth/BirthState";
import { BirthOperationAllocator } from "@server/components/BirthOperationAllocator";
import { Player } from "@shared/components/Player";
import { createBabyData } from "@shared/domain/birth/BabyData";
import { PregnancyRecoveryOptions } from "@shared/components/PregnancyRecoveryOptions";
import { createDefaultWombState } from "@shared/domain/womb/WombState";
import { createDefaultLactationState } from "@shared/domain/lactation/LactationState";

/** Validates and handles ZLBF commands received in the server execution context. */
export class CommandHandler {
	/** Creates a handler backed by the server-owned player-state repository. */
	constructor(
		private readonly states = new StateRepository(),
		private readonly pregnancy = new PregnancyReconciler(),
		private readonly births = new BirthOperationAllocator(),
		private readonly recovery = new PregnancyRecoveryOptions()
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
			this.setPregnancyState(
				player,
				args,
				ZLBFNetworkCommand.SET_PREGNANCY_STATE_RESPONSE,
				true
			);
			return;
		}
		if (command === ZLBFNetworkCommand.PUBLISH_PREGNANCY_STATE_REQUEST) {
			this.setPregnancyState(
				player,
				args,
				ZLBFNetworkCommand.PUBLISH_PREGNANCY_STATE_RESPONSE,
				false
			);
			return;
		}
		if (command === ZLBFNetworkCommand.ALLOCATE_BIRTH_REQUEST) {
			this.allocateBirth(player, args);
			return;
		}
		if (command === ZLBFNetworkCommand.COMPLETE_BIRTH_REQUEST) {
			this.completeBirth(player, args);
			return;
		}
		if (command === ZLBFNetworkCommand.PUBLISH_WOMB_STATE_REQUEST) {
			this.publishWombState(player, args);
			return;
		}
		if (command === ZLBFNetworkCommand.PUBLISH_LACTATION_STATE_REQUEST) {
			this.publishLactationState(player, args);
		}
	}

	/** Persists complete client-simulated Lactation state when based on the current version. */
	private publishLactationState(player: IsoPlayer, args: unknown): void {
		if (!isZLBFPublishLactationStateRequest(args)) return;
		const loaded = this.loadForProtocol(player, args.schemaVersion);
		const status = this.loadStatus(args.schemaVersion, loaded);
		if (
			status === ZLBFSyncStatus.OK &&
			loaded?.supported &&
			args.baseStateVersion === loaded.stateVersion
		) {
			const desired = args.data.desired;
			const current = loaded.state.domains.lactation;
			if (
				current.isActive !== desired.isActive ||
				current.milkAmount !== desired.milkAmount ||
				current.expiration !== desired.expiration ||
				current.multiplier !== desired.multiplier
			) {
				loaded.state.domains.lactation = { ...desired };
				loaded.state.stateVersion += 1;
				loaded.stateVersion = loaded.state.stateVersion;
				this.states.save(player, loaded.state);
			}
		}
		this.sendSnapshot(
			player,
			ZLBFNetworkCommand.PUBLISH_LACTATION_STATE_RESPONSE,
			args,
			status,
			loaded
		);
	}

	/** Persists client-simulated reversible Womb contents and cycle progression. */
	private publishWombState(player: IsoPlayer, args: unknown): void {
		if (!isZLBFPublishWombStateRequest(args)) return;
		const loaded = this.loadForProtocol(player, args.schemaVersion);
		const status = this.loadStatus(args.schemaVersion, loaded);
		if (status === ZLBFSyncStatus.OK && loaded?.supported) {
			const desired = args.data.desired;
			const womb = loaded.state.domains.womb;
			const clearsContraceptive =
				womb.onContraceptive === true && desired.onContraceptive === false;
			const acceptedBase = args.baseStateVersion === loaded.stateVersion;
			const acceptedClear = !clearsContraceptive || desired.cycleDay !== womb.cycleDay;
			if (
				acceptedBase &&
				acceptedClear &&
				(womb.cycleDay !== desired.cycleDay ||
					womb.amount !== desired.amount ||
					womb.total !== desired.total ||
					(desired.onContraceptive !== undefined &&
						womb.onContraceptive !== desired.onContraceptive))
			) {
				loaded.state.domains.womb = {
					cycleDay: desired.cycleDay,
					amount: desired.amount,
					total: desired.total,
					onContraceptive: desired.onContraceptive ?? womb.onContraceptive
				};
				loaded.state.stateVersion += 1;
				loaded.stateVersion = loaded.state.stateVersion;
				this.states.save(player, loaded.state);
			}
		}
		this.sendSnapshot(
			player,
			ZLBFNetworkCommand.PUBLISH_WOMB_STATE_RESPONSE,
			args,
			status,
			loaded
		);
	}

	/**
	 * Validates and durably completes a pending birth operation on the server.
	 * Dead characters receive an invalid response with their unchanged authoritative snapshot.
	 */
	private completeBirth(player: IsoPlayer, args: unknown): void {
		if (!isZLBFCompleteBirthRequest(args)) return;
		const loaded = this.loadForProtocol(player, args.schemaVersion);
		let status = this.loadStatus(args.schemaVersion, loaded);
		if (status === ZLBFSyncStatus.OK && player.isDead()) {
			status = ZLBFSyncStatus.INVALID_REQUEST;
		} else if (status === ZLBFSyncStatus.OK && loaded?.supported) {
			const birth = loaded.state.domains.birth;
			if (birth.completedBirthId === args.data.birthId) {
				// An acknowledged operation may be retried after a lost response.
			} else if (birth.pendingBirthId !== args.data.birthId) {
				status = ZLBFSyncStatus.INVALID_REQUEST;
			} else {
				const mother = new Player(player).identity;
				if (!mother) {
					status = ZLBFSyncStatus.INVALID_REQUEST;
				} else {
					const baby = instanceItem(ITEMS.BABY);
					if (!baby) {
						status = ZLBFSyncStatus.INVALID_REQUEST;
					} else {
						const babyData = createBabyData(mother, birth.birthSequence);
						(baby.getModData() as unknown as Record<string, unknown>).ZLBF = babyData;
						const inventory = player.getInventory();
						inventory.AddItem(baby);
						sendAddItemToContainer(inventory, baby);
						loaded.state.domains.birth = {
							birthSequence: birth.birthSequence,
							completedBirthId: args.data.birthId
						};
						loaded.state.domains.pregnancy = createDefaultPregnancyState();
						const recovery = this.recovery.read();
						loaded.state.domains.womb = {
							...loaded.state.domains.womb,
							cycleDay: recovery.days === 0 ? 1 : -recovery.days
						};
						if (recovery.usedFallback) {
							print("[ZLBF][MP][Server] invalid PregnancyRecovery; using default=7");
						}
						loaded.state.stateVersion += 1;
						loaded.stateVersion = loaded.state.stateVersion;
						this.states.save(player, loaded.state);
						this.applyPregnancyTrait(player, PregnancyStatus.NOT_PREGNANT);
						print(
							`[ZLBF][MP][Server] completed birth player=${mother.username} birthId=${babyData.birthId} motherName=${mother.name}`
						);
					}
				}
			}
		}
		this.sendSnapshot(player, ZLBFNetworkCommand.COMPLETE_BIRTH_RESPONSE, args, status, loaded);
	}

	/**
	 * Allocates a pending birth only for a living character whose authoritative Pregnancy reached
	 * labor. Dead characters receive an invalid response with their unchanged snapshot.
	 */
	private allocateBirth(player: IsoPlayer, args: unknown): void {
		if (!isZLBFAllocateBirthRequest(args)) {
			print(
				`[ZLBF][MP][Server] rejected malformed birth allocation from ${player.getUsername()}`
			);
			return;
		}

		const loaded = this.loadForProtocol(player, args.schemaVersion);
		let status = this.loadStatus(args.schemaVersion, loaded);
		if (status === ZLBFSyncStatus.OK && player.isDead()) {
			status = ZLBFSyncStatus.INVALID_REQUEST;
		} else if (status === ZLBFSyncStatus.OK && loaded?.supported) {
			const pregnancy = loaded.state.domains.pregnancy;
			if (pregnancy.status !== PregnancyStatus.PREGNANT || !pregnancy.isInLabor) {
				status = ZLBFSyncStatus.INVALID_REQUEST;
			} else {
				const allocation = this.births.allocate(
					loaded.state.domains.birth,
					player.getUsername()
				);
				if (allocation.changed) {
					loaded.state.domains.birth = allocation.state;
					loaded.state.stateVersion += 1;
					loaded.stateVersion = loaded.state.stateVersion;
					this.states.save(player, loaded.state);
				}
				print(
					`[ZLBF][MP][Server] birth allocation player=${player.getUsername()} birthId=${allocation.birthId} changed=${allocation.changed}`
				);
			}
		}

		this.sendSnapshot(player, ZLBFNetworkCommand.ALLOCATE_BIRTH_RESPONSE, args, status, loaded);
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

	/** Handles a reversible Pregnancy state publication through its selected route. */
	private setPregnancyState(
		player: IsoPlayer,
		args: unknown,
		responseCommand: ZLBFNetworkCommand,
		debugOnly: boolean
	): void {
		if (!isZLBFSetPregnancyStateRequest(args)) {
			print(
				`[ZLBF][MP][Server] rejected malformed Pregnancy request from ${player.getUsername()}`
			);
			return;
		}

		const loaded = this.loadForProtocol(player, args.schemaVersion);
		let status = this.loadStatus(args.schemaVersion, loaded);
		if (status === ZLBFSyncStatus.OK && debugOnly && !isDebugEnabled()) {
			status = ZLBFSyncStatus.FORBIDDEN;
		}

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

		this.sendSnapshot(player, responseCommand, args, status, loaded);
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
					: createDefaultPregnancyState(),
				birth: state?.supported ? state.state.domains.birth : createDefaultBirthState(),
				womb: state?.supported ? state.state.domains.womb : createDefaultWombState(),
				lactation: state?.supported
					? state.state.domains.lactation
					: createDefaultLactationState()
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
