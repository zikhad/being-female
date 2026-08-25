import {
	IsoPlayer,
	isDebugEnabled,
	sendServerCommand,
	instanceItem
} from "@asledgehammer/pipewrench";
import {
	BF_STATE_SCHEMA_VERSION,
	BF_NETWORK_MODULE,
	BF_PROTOCOL_SCHEMA_VERSION,
	ITEMS,
	BFTraitsEnum,
	BFNetworkCommand,
	BFSyncStatus
} from "@constants";
import {
	isBFSetPregnancyStateRequest,
	isBFAllocateBirthRequest,
	isBFCompleteBirthRequest,
	isBFConvertCondomRequest,
	isBFPublishWombStateRequest,
	isBFPublishLactationStateRequest,
	isBFSyncStateRequest,
	BFSetPregnancyStateRequest,
	BFSnapshot,
	BFSyncStateResponse
} from "@shared/BFProtocol";
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

/** Validates and handles BF commands received in the server execution context. */
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
		if (module !== BF_NETWORK_MODULE) return;
		if (!player) {
			print(`[BF][MP][Server] ignored ${command} before player binding`);
			return;
		}
		switch (command) {
			case BFNetworkCommand.SYNC_STATE_REQUEST:
				this.syncState(player, args);
				return;
			case BFNetworkCommand.SET_PREGNANCY_STATE_REQUEST:
				this.setPregnancyState(
					player,
					args,
					BFNetworkCommand.SET_PREGNANCY_STATE_RESPONSE,
					true
				);
				return;
			case BFNetworkCommand.PUBLISH_PREGNANCY_STATE_REQUEST:
				this.setPregnancyState(
					player,
					args,
					BFNetworkCommand.PUBLISH_PREGNANCY_STATE_RESPONSE,
					false
				);
				return;
			case BFNetworkCommand.ALLOCATE_BIRTH_REQUEST:
				this.allocateBirth(player, args);
				return;
			case BFNetworkCommand.COMPLETE_BIRTH_REQUEST:
				this.completeBirth(player, args);
				return;
			case BFNetworkCommand.CONVERT_CONDOM_REQUEST:
				this.convertCondom(player, args);
				return;
			case BFNetworkCommand.PUBLISH_WOMB_STATE_REQUEST:
				this.publishWombState(player, args);
				return;
			case BFNetworkCommand.PUBLISH_LACTATION_STATE_REQUEST:
				this.publishLactationState(player, args);
		}
	}

	/** Replaces one current authenticated-player condom using server inventory authority. */
	private convertCondom(player: IsoPlayer, args: unknown): void {
		if (!isBFConvertCondomRequest(args)) return;
		if (args.schemaVersion !== BF_PROTOCOL_SCHEMA_VERSION || player.isDead()) return;
		const inventory = player.getInventory();
		const condom = inventory.getFirstType(ITEMS.CONDOM);
		if (!condom) return;
		const used = instanceItem(ITEMS.CONDOM_USED);
		if (!used) return;
		inventory.Remove(condom);
		sendRemoveItemFromContainer(inventory, condom);
		inventory.AddItem(used);
		sendAddItemToContainer(inventory, used);
	}

	/** Persists complete client-simulated Lactation state when based on the current version. */
	private publishLactationState(player: IsoPlayer, args: unknown): void {
		if (!isBFPublishLactationStateRequest(args)) return;
		const loaded = this.loadForProtocol(player, args.schemaVersion);
		const status = this.loadStatus(args.schemaVersion, loaded);
		if (
			status === BFSyncStatus.OK &&
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
			BFNetworkCommand.PUBLISH_LACTATION_STATE_RESPONSE,
			args,
			status,
			loaded
		);
	}

	/** Persists client-simulated reversible Womb contents and cycle progression. */
	private publishWombState(player: IsoPlayer, args: unknown): void {
		if (!isBFPublishWombStateRequest(args)) return;
		const loaded = this.loadForProtocol(player, args.schemaVersion);
		const status = this.loadStatus(args.schemaVersion, loaded);
		if (status === BFSyncStatus.OK && loaded?.supported) {
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
			BFNetworkCommand.PUBLISH_WOMB_STATE_RESPONSE,
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
		if (!isBFCompleteBirthRequest(args)) return;
		const loaded = this.loadForProtocol(player, args.schemaVersion);
		let status = this.loadStatus(args.schemaVersion, loaded);
		if (status === BFSyncStatus.OK && player.isDead()) {
			status = BFSyncStatus.INVALID_REQUEST;
		} else if (status === BFSyncStatus.OK && loaded?.supported) {
			const birth = loaded.state.domains.birth;
			if (birth.completedBirthId === args.data.birthId) {
				// An acknowledged operation may be retried after a lost response.
			} else if (birth.pendingBirthId !== args.data.birthId) {
				status = BFSyncStatus.INVALID_REQUEST;
			} else {
				const mother = new Player(player).identity;
				if (!mother) {
					status = BFSyncStatus.INVALID_REQUEST;
				} else {
					const baby = instanceItem(ITEMS.BABY);
					if (!baby) {
						status = BFSyncStatus.INVALID_REQUEST;
					} else {
						const babyData = createBabyData({
							birthId: args.data.birthId,
							motherCharacterId: loaded.state.characterId,
							mother,
							birthSequence: birth.birthSequence
						});
						(baby.getModData() as unknown as Record<string, unknown>).BF = babyData;
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
							print("[BF][MP][Server] invalid PregnancyRecovery; using default=7");
						}
						loaded.state.stateVersion += 1;
						loaded.stateVersion = loaded.state.stateVersion;
						this.states.save(player, loaded.state);
						this.applyPregnancyTrait(player, PregnancyStatus.NOT_PREGNANT);
						print(
							`[BF][MP][Server] completed birth player=${mother.username} birthId=${babyData.birthId} motherName=${mother.name}`
						);
					}
				}
			}
		}
		this.sendSnapshot(player, BFNetworkCommand.COMPLETE_BIRTH_RESPONSE, args, status, loaded);
	}

	/**
	 * Allocates a pending birth only for a living character whose authoritative Pregnancy reached
	 * labor. Dead characters receive an invalid response with their unchanged snapshot.
	 */
	private allocateBirth(player: IsoPlayer, args: unknown): void {
		if (!isBFAllocateBirthRequest(args)) {
			print(
				`[BF][MP][Server] rejected malformed birth allocation from ${player.getUsername()}`
			);
			return;
		}

		const loaded = this.loadForProtocol(player, args.schemaVersion);
		let status = this.loadStatus(args.schemaVersion, loaded);
		if (status === BFSyncStatus.OK && player.isDead()) {
			status = BFSyncStatus.INVALID_REQUEST;
		} else if (status === BFSyncStatus.OK && loaded?.supported) {
			const pregnancy = loaded.state.domains.pregnancy;
			if (pregnancy.status !== PregnancyStatus.PREGNANT || !pregnancy.isInLabor) {
				status = BFSyncStatus.INVALID_REQUEST;
			} else {
				const allocation = this.births.allocate(
					loaded.state.domains.birth,
					loaded.state.characterId
				);
				if (allocation.changed) {
					loaded.state.domains.birth = allocation.state;
					loaded.state.stateVersion += 1;
					loaded.stateVersion = loaded.state.stateVersion;
					this.states.save(player, loaded.state);
				}
				print(
					`[BF][MP][Server] birth allocation player=${player.getUsername()} birthId=${allocation.birthId} changed=${allocation.changed}`
				);
			}
		}

		this.sendSnapshot(player, BFNetworkCommand.ALLOCATE_BIRTH_RESPONSE, args, status, loaded);
	}

	/** Handles a validated read-only authoritative snapshot request. */
	private syncState(player: IsoPlayer, args: unknown): void {
		if (!isBFSyncStateRequest(args)) {
			print(`[BF][MP][Server] rejected malformed request from ${player.getUsername()}`);
			return;
		}

		const state = this.loadForProtocol(player, args.schemaVersion);
		const status = this.loadStatus(args.schemaVersion, state);
		if (status === BFSyncStatus.OK && state?.supported) {
			this.applyPregnancyTrait(player, state.state.domains.pregnancy.status);
		}
		this.sendSnapshot(player, BFNetworkCommand.SYNC_STATE_RESPONSE, args, status, state);
	}

	/** Handles a reversible Pregnancy state publication through its selected route. */
	private setPregnancyState(
		player: IsoPlayer,
		args: unknown,
		responseCommand: BFNetworkCommand,
		debugOnly: boolean
	): void {
		if (!isBFSetPregnancyStateRequest(args)) {
			print(
				`[BF][MP][Server] rejected malformed Pregnancy request from ${player.getUsername()}`
			);
			return;
		}

		const loaded = this.loadForProtocol(player, args.schemaVersion);
		let status = this.loadStatus(args.schemaVersion, loaded);
		if (status === BFSyncStatus.OK && debugOnly && !isDebugEnabled()) {
			status = BFSyncStatus.FORBIDDEN;
		}

		if (status === BFSyncStatus.OK && loaded?.supported) {
			const reconciliation = this.pregnancy.reconcile(
				loaded.state.domains.pregnancy,
				args.data.desired
			);
			if (!reconciliation.valid) {
				status = BFSyncStatus.INVALID_REQUEST;
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
		return schemaVersion === BF_PROTOCOL_SCHEMA_VERSION ? this.states.load(player) : undefined;
	}

	/** Maps protocol and persistence compatibility to a response status. */
	private loadStatus(schemaVersion: number, state?: StateLoadResult): BFSyncStatus {
		if (schemaVersion !== BF_PROTOCOL_SCHEMA_VERSION) return BFSyncStatus.UNSUPPORTED_SCHEMA;
		return state?.supported ? BFSyncStatus.OK : BFSyncStatus.UNSUPPORTED_DATA_SCHEMA;
	}

	/** Reconciles the server-owned compatibility trait with authoritative Pregnancy status. */
	private applyPregnancyTrait(player: IsoPlayer, status: PregnancyStatus): void {
		if (status === PregnancyStatus.PREGNANT) {
			CharacterTraitApi.addTrait(player, BFTraitsEnum.PREGNANCY);
			return;
		}
		CharacterTraitApi.removeTrait(player, BFTraitsEnum.PREGNANCY);
	}

	/** Creates client-visible snapshot data without exposing mutable server storage. */
	private snapshot(state?: StateLoadResult): BFSnapshot {
		return {
			schemaVersion: state?.schemaVersion ?? BF_STATE_SCHEMA_VERSION,
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
		command: BFNetworkCommand,
		request: Pick<BFSetPregnancyStateRequest, "requestId" | "revision">,
		status: BFSyncStatus,
		state?: StateLoadResult
	): void {
		const response: BFSyncStateResponse = {
			schemaVersion: BF_PROTOCOL_SCHEMA_VERSION,
			requestId: request.requestId,
			revision: request.revision,
			status,
			data: { snapshot: this.snapshot(state) }
		};
		print(
			`[BF][MP][Server] reply ${response.requestId} revision=${response.revision} status=${response.status}`
		);
		sendServerCommand(player, BF_NETWORK_MODULE, command, response);
	}
}
