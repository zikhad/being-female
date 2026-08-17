import {
	InventoryItem,
	IsoPlayer,
	isServer,
	sendServerCommand,
	ZombRandFloat
} from "@asledgehammer/pipewrench";
import {
	Fluids,
	ZLBF_NETWORK_MODULE,
	ZLBF_PROTOCOL_SCHEMA_VERSION,
	ZLBFNetworkCommand,
	ZLBFSyncStatus
} from "@constants";
import { Recipe } from "server/types";
import { FluidContainerApi } from "@shared/components/FluidContainerApi";
import { readRecipeActorState, resolveRecipeLactation } from "@shared/components/RecipeActorState";
import { StateRepository } from "@server/components/state/StateRepository";
import type { LactationState } from "@shared/domain/lactation/LactationState";
import type { ZLBFSyncStateResponse } from "@shared/ZLBFProtocol";
import { RECIPE_BOTTLE_AMOUNT, ZLBFRecipeTests } from "@shared/ZLBFRecipeTests";
import type { AuthoritativeState } from "@server/components/state/AuthoritativeState";

declare let ZLBFRecipes: Recipe;

const states = new StateRepository();
/**
 * Persists a focused recipe mutation and acknowledges the resulting snapshot in multiplayer.
 *
 * @param player Callback-supplied actor whose authoritative root is mutated.
 * @param mutate Domain mutation applied only to a supported current authoritative state.
 * @returns Nothing; unsupported future state is preserved without acknowledgement.
 */
const saveRecipeState = (player: IsoPlayer, mutate: (state: AuthoritativeState) => void): void => {
	const loaded = states.load(player);
	if (!loaded.supported) return;
	mutate(loaded.state);
	loaded.state.stateVersion += 1;
	loaded.stateVersion = loaded.state.stateVersion;
	states.save(player, loaded.state);
	if (typeof isServer !== "function" || !isServer()) return;
	const response: ZLBFSyncStateResponse = {
		schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
		requestId: `recipe-${loaded.stateVersion}`,
		revision: loaded.stateVersion,
		status: ZLBFSyncStatus.OK,
		data: { snapshot: loaded.state }
	};
	sendServerCommand(
		player,
		ZLBF_NETWORK_MODULE,
		ZLBFNetworkCommand.RECIPE_STATE_RESPONSE,
		response
	);
};

/**
 * Applies milk use to complete Lactation data without mutating its input.
 *
 * @param state Current complete actor Lactation state.
 * @param amount Milk volume to consume, clamped to the available amount.
 * @param multiplier Replacement production multiplier, clamped to zero.
 * @returns A complete updated Lactation value preserving unrelated fields.
 */
const useMilk = (state: LactationState, amount: number, multiplier: number): LactationState => ({
	...state,
	milkAmount: Math.max(0, state.milkAmount - Math.min(amount, state.milkAmount)),
	multiplier: Math.max(0, multiplier)
});

/**
 * Resolves, writes, persists, and acknowledges one actor-scoped Lactation mutation.
 * Valid authoritative state takes precedence over legacy data, including an all-zero state.
 *
 * @param player Callback-supplied actor whose Lactation state changes.
 * @param mutate Pure transformation applied to the resolved complete state.
 * @returns Nothing; both compatibility ModData and authoritative state are updated when supported.
 */
const saveLactation = (
	player: IsoPlayer,
	mutate: (current: LactationState) => LactationState
): void => {
	const actor = readRecipeActorState(player);
	const next = mutate(resolveRecipeLactation(actor));
	(player.getModData() as unknown as Record<string, unknown>).ZLBFLactation = next;
	saveRecipeState(player, state => {
		state.domains.lactation = next;
	});
};

/**
 * Synchronizes fields only when a recipe mutates its item in server context.
 *
 * @param item Authoritatively mutated fluid item to broadcast.
 * @returns Nothing; single-player and client contexts remain local no-ops.
 */
const syncFluidItem = (item: InventoryItem): void => {
	if (typeof isServer === "function" && isServer()) item.syncItemFields();
};

/**
 * Preflights recipe side effects without overwriting a future state schema.
 *
 * @param player Callback actor whose authoritative root controls mutation support.
 * @returns Whether item and compatibility mutations may safely proceed.
 */
const supportsRecipeMutation = (player: IsoPlayer): boolean => states.load(player).supported;

ZLBFRecipes = {
	OnTest: ZLBFRecipeTests,
	OnCreate: {
		TakeContraceptive: (_items, character) => {
			const player = character as IsoPlayer;
			if (!supportsRecipeMutation(player)) return;
			const actor = readRecipeActorState(character);
			if (actor.womb) actor.womb.onContraceptive = true;
			saveRecipeState(player, state => {
				state.domains.womb = { ...state.domains.womb, onContraceptive: true };
			});
		},
		TakeLactaid: (_items, character) => {
			const player = character as IsoPlayer;
			if (!supportsRecipeMutation(player)) return;
			saveLactation(player, current =>
				useMilk({ ...current, isActive: true }, 0, ZombRandFloat(0, 0.3))
			);
		},
		HandExpress: (items, character) => {
			const player = character as IsoPlayer;
			if (!supportsRecipeMutation(player)) return;
			const container = items.getInputItems(0).get(0) as InventoryItem;
			const amount = new FluidContainerApi(container).fill(
				Fluids.HUMAN_MILK,
				RECIPE_BOTTLE_AMOUNT
			);
			syncFluidItem(container);
			saveLactation(player, current =>
				useMilk(current, amount * 2, ZombRandFloat(0.05, 0.1))
			);
		},
		BreastPump: (items, character) => {
			const player = character as IsoPlayer;
			if (!supportsRecipeMutation(player)) return;
			const container = items.getInputItems(1).get(0) as InventoryItem;
			const amount = new FluidContainerApi(container).fill(
				Fluids.HUMAN_MILK,
				RECIPE_BOTTLE_AMOUNT
			);
			syncFluidItem(container);
			saveLactation(player, current => useMilk(current, amount, ZombRandFloat(0.1, 0.2)));
		},
		ClearSperm: (items, character) => {
			const player = character as IsoPlayer;
			if (!supportsRecipeMutation(player)) return;
			const container = items.getInputItems(0).get(0) as InventoryItem;
			new FluidContainerApi(container).clear();
			syncFluidItem(container);
			const actor = readRecipeActorState(character);
			if (actor.womb) actor.womb.amount = 0;
			saveRecipeState(player, state => {
				state.domains.womb = { ...state.domains.womb, amount: 0 };
			});
		},
		PushCum: (items, character) => {
			const player = character as IsoPlayer;
			if (!supportsRecipeMutation(player)) return;
			const actor = readRecipeActorState(character);
			const current = actor.authoritative?.womb.amount ?? actor.womb?.amount ?? 0;
			const container = items.getInputItems(0).get(0) as InventoryItem;
			const filled = new FluidContainerApi(container).fill(Fluids.SEMEN, current);
			syncFluidItem(container);
			const remaining = current - Math.min(current, filled);
			if (actor.womb) actor.womb.amount = remaining;
			saveRecipeState(player, state => {
				state.domains.womb = { ...state.domains.womb, amount: remaining };
			});
		},
		BreastFeedBaby: (_items, character) => {
			const player = character as IsoPlayer;
			if (!supportsRecipeMutation(player)) return;
			saveLactation(player, current =>
				useMilk(current, RECIPE_BOTTLE_AMOUNT, ZombRandFloat(0.2, 0.5))
			);
		},
		BottleFeedBaby: (items, character) => {
			if (!supportsRecipeMutation(character as IsoPlayer)) return;
			const container = items.getInputItems(0).get(0) as InventoryItem;
			new FluidContainerApi(container).clear(RECIPE_BOTTLE_AMOUNT);
			syncFluidItem(container);
		}
	}
};

export { ZLBFRecipes };
