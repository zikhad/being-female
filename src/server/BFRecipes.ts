import { InventoryItem, IsoPlayer, isServer, sendServerCommand } from "@asledgehammer/pipewrench";
import {
	Fluids,
	BF_NETWORK_MODULE,
	BF_PROTOCOL_SCHEMA_VERSION,
	BFNetworkCommand,
	BFSyncStatus,
	BFTraitsEnum
} from "@constants";
import { Recipe } from "server/types";
import { FluidContainerApi } from "@shared/components/FluidContainerApi";
import { readRecipeActorState, resolveRecipeLactation } from "@shared/components/RecipeActorState";
import { StateRepository } from "@server/components/state/StateRepository";
import type { LactationState } from "@shared/domain/lactation/LactationState";
import type { BFSyncStateResponse } from "@shared/BFProtocol";
import { RECIPE_BOTTLE_AMOUNT, BFRecipeTests } from "@shared/BFRecipeTests";
import { CharacterTraitApi } from "@shared/components/CharacterTraitApi";
import {
	addLactaidStimulation,
	applyMilkRemoval,
	lactationDuration
} from "@shared/domain/lactation/LactationBalance";
import { configuredLactationDurationHours } from "@shared/components/BFSandboxOptions";
import type {
	AuthoritativeState,
	SupportedStateLoadResult
} from "@server/components/state/AuthoritativeState";

declare let BFRecipes: Recipe;

const states = new StateRepository();

/** Returns whether this recipe callback is executing on multiplayer server authority. */
const isServerRecipeContext = (): boolean => typeof isServer === "function" && isServer();
/**
 * Persists a focused recipe mutation and acknowledges the resulting snapshot in multiplayer.
 *
 * @param player Callback-supplied actor whose authoritative root is mutated.
 * @param loaded Supported state loaded before any recipe side effect.
 * @param mutate Domain mutation applied only to a supported current authoritative state.
 * @returns Nothing; unsupported future state is preserved without acknowledgement.
 */
const saveRecipeState = (
	player: IsoPlayer,
	loaded: SupportedStateLoadResult,
	mutate: (state: AuthoritativeState) => void
): void => {
	mutate(loaded.state);
	loaded.state.stateVersion += 1;
	loaded.stateVersion = loaded.state.stateVersion;
	states.save(player, loaded.state);
	if (!isServerRecipeContext()) return;
	const response: BFSyncStateResponse = {
		schemaVersion: BF_PROTOCOL_SCHEMA_VERSION,
		requestId: `recipe-${loaded.stateVersion}`,
		revision: loaded.stateVersion,
		status: BFSyncStatus.OK,
		data: { snapshot: loaded.state }
	};
	sendServerCommand(player, BF_NETWORK_MODULE, BFNetworkCommand.RECIPE_STATE_RESPONSE, response);
};

/**
 * Returns the actor's configured lactation duration with trait modification applied once.
 *
 * @param player Recipe actor whose Dairy Cow trait controls duration.
 * @returns Duration in game hours.
 */
const refreshedLactationDuration = (player: IsoPlayer): number =>
	lactationDuration(
		configuredLactationDurationHours(),
		CharacterTraitApi.hasTrait(player, BFTraitsEnum.DAIRY_COW)
	);

/**
 * Resolves, writes, persists, and acknowledges one actor-scoped Lactation mutation.
 * Single-player keeps its local gameplay backend; multiplayer server callbacks write only the
 * authoritative root.
 *
 * @param player Callback-supplied actor whose Lactation state changes.
 * @param loaded Supported state loaded before any recipe side effect.
 * @param mutate Pure transformation applied to the resolved complete state.
 * @returns Nothing; local state is updated only in single-player contexts.
 */
const saveLactation = (
	player: IsoPlayer,
	loaded: SupportedStateLoadResult,
	mutate: (current: LactationState) => LactationState
): void => {
	const actor = readRecipeActorState(player);
	const next = mutate(resolveRecipeLactation(actor));
	if (!isServerRecipeContext()) {
		(player.getModData() as unknown as Record<string, unknown>).BFLactation = next;
	}
	saveRecipeState(player, loaded, state => {
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
	if (isServerRecipeContext()) item.syncItemFields();
};

/**
 * Preflights recipe side effects without overwriting a future state schema.
 *
 * @param player Callback actor whose authoritative root controls mutation support.
 * @returns Supported state, or undefined when the persisted schema cannot be mutated.
 */
const loadRecipeState = (player: IsoPlayer): SupportedStateLoadResult | undefined => {
	const loaded = states.load(player);
	return loaded.supported ? loaded : undefined;
};

// The Project Zomboid loader requires assignment to its declared recipe callback global.
// eslint-disable-next-line prefer-const
BFRecipes = {
	OnTest: BFRecipeTests,
	OnCreate: {
		TakeContraceptive: (_items, character) => {
			const player = character as IsoPlayer;
			const loaded = loadRecipeState(player);
			if (!loaded) return;
			const actor = readRecipeActorState(character);
			if (!isServerRecipeContext() && actor.womb) actor.womb.onContraceptive = true;
			saveRecipeState(player, loaded, state => {
				state.domains.womb = { ...state.domains.womb, onContraceptive: true };
			});
		},
		TakeLactaid: (_items, character) => {
			const player = character as IsoPlayer;
			const loaded = loadRecipeState(player);
			if (!loaded) return;
			saveLactation(player, loaded, current => ({
				...current,
				isActive: true,
				expiration: refreshedLactationDuration(player),
				multiplier: addLactaidStimulation(current.multiplier)
			}));
		},
		HandExpress: (items, character) => {
			const player = character as IsoPlayer;
			const loaded = loadRecipeState(player);
			if (!loaded) return;
			const container = items.getInputItems(0).get(0) as InventoryItem;
			const amount = new FluidContainerApi(container).fill(
				Fluids.HUMAN_MILK,
				RECIPE_BOTTLE_AMOUNT
			);
			syncFluidItem(container);
			saveLactation(player, loaded, current =>
				applyMilkRemoval(current, amount * 2, refreshedLactationDuration(player))
			);
		},
		BreastPump: (items, character) => {
			const player = character as IsoPlayer;
			const loaded = loadRecipeState(player);
			if (!loaded) return;
			const container = items.getInputItems(1).get(0) as InventoryItem;
			const amount = new FluidContainerApi(container).fill(
				Fluids.HUMAN_MILK,
				RECIPE_BOTTLE_AMOUNT
			);
			syncFluidItem(container);
			saveLactation(player, loaded, current =>
				applyMilkRemoval(current, amount, refreshedLactationDuration(player))
			);
		},
		ClearSperm: (items, character) => {
			const player = character as IsoPlayer;
			const loaded = loadRecipeState(player);
			if (!loaded) return;
			const container = items.getInputItems(0).get(0) as InventoryItem;
			new FluidContainerApi(container).clear();
			syncFluidItem(container);
			const actor = readRecipeActorState(character);
			if (!isServerRecipeContext() && actor.womb) actor.womb.amount = 0;
			saveRecipeState(player, loaded, state => {
				state.domains.womb = { ...state.domains.womb, amount: 0 };
			});
		},
		PushCum: (items, character) => {
			const player = character as IsoPlayer;
			const loaded = loadRecipeState(player);
			if (!loaded) return;
			const actor = readRecipeActorState(character);
			const current = actor.authoritative?.womb.amount ?? actor.womb?.amount ?? 0;
			const container = items.getInputItems(0).get(0) as InventoryItem;
			const filled = new FluidContainerApi(container).fill(Fluids.SEMEN, current);
			syncFluidItem(container);
			const remaining = current - Math.min(current, filled);
			if (!isServerRecipeContext() && actor.womb) actor.womb.amount = remaining;
			saveRecipeState(player, loaded, state => {
				state.domains.womb = { ...state.domains.womb, amount: remaining };
			});
		},
		BreastFeedBaby: (_items, character) => {
			const player = character as IsoPlayer;
			const loaded = loadRecipeState(player);
			if (!loaded) return;
			saveLactation(player, loaded, current =>
				applyMilkRemoval(current, RECIPE_BOTTLE_AMOUNT, refreshedLactationDuration(player))
			);
		},
		BottleFeedBaby: (items, character) => {
			if (!loadRecipeState(character as IsoPlayer)) return;
			const container = items.getInputItems(0).get(0) as InventoryItem;
			new FluidContainerApi(container).clear(RECIPE_BOTTLE_AMOUNT);
			syncFluidItem(container);
		}
	}
};

export { BFRecipes };
