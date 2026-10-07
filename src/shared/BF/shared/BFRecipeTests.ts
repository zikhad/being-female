import type { InventoryItem, IsoGameCharacter, IsoPlayer } from "@asledgehammer/pipewrench";
import { Fluids, ITEMS, BFTraitsEnum } from "@constants";
import { FluidContainerApi } from "@shared/components/FluidContainerApi";
import { readRecipeActorState, resolveRecipeLactation } from "@shared/components/RecipeActorState";
import { CharacterTraitApi } from "@shared/components/CharacterTraitApi";
import { PregnancyStatus } from "@shared/domain/pregnancy/PregnancyState";

/**
 * Side-effect-free recipe eligibility callback.
 *
 * @param item Candidate recipe input inspected without mutation.
 * @param character Callback-supplied actor whose state determines eligibility.
 * @returns Whether the recipe may proceed for this actor and item.
 */
export type RecipeTest = (item: InventoryItem, character: IsoGameCharacter) => boolean;

/** Standard recipe transfer volume in liters. */
export const RECIPE_BOTTLE_AMOUNT = 0.2;

/** Resolves Pregnancy with authoritative status before explicit legacy status or trait presence. */
const isPregnant = (character: IsoGameCharacter): boolean => {
	const actor = readRecipeActorState(character);
	const authoritative = actor.authoritative?.pregnancy.status;
	if (authoritative !== undefined) return authoritative === PregnancyStatus.PREGNANT;
	const legacyStatus = (actor.pregnancy as { status?: PregnancyStatus } | undefined)?.status;
	if (legacyStatus !== undefined) return legacyStatus === PregnancyStatus.PREGNANT;
	return CharacterTraitApi.hasTrait(character as IsoPlayer, BFTraitsEnum.PREGNANCY);
};

/**
 * Shared-safe callbacks used by both client recipe menus and server validation.
 * Every callback is read-only and resolves state from its supplied character.
 */
export const BFRecipeTests: Record<string, RecipeTest> = {
	TakeContraceptive: (_item, character) => {
		if (!character.isFemale()) return false;
		const actor = readRecipeActorState(character);
		if (actor.authoritative?.womb.onContraceptive ?? actor.womb?.onContraceptive) return false;
		if ((actor.authoritative?.womb.cycleDay ?? actor.womb?.cycleDay ?? 0) < 1) return false;
		return !isPregnant(character);
	},
	TakeLactaid: (_item, character) => character.isFemale(),
	HandExpress: (item, character) =>
		character.isFemale() &&
		!new FluidContainerApi(item).isFull() &&
		resolveRecipeLactation(readRecipeActorState(character)).milkAmount >=
			RECIPE_BOTTLE_AMOUNT * 2,
	BreastPump: (item, character) =>
		character.isFemale() &&
		!new FluidContainerApi(item).isFull() &&
		resolveRecipeLactation(readRecipeActorState(character)).milkAmount >= RECIPE_BOTTLE_AMOUNT,
	ClearSperm: (_item, character) => {
		const actor = readRecipeActorState(character);
		return (
			character.isFemale() &&
			(actor.authoritative?.womb.amount ?? actor.womb?.amount ?? 0) > 0
		);
	},
	PushCum: (item, character) => {
		const actor = readRecipeActorState(character);
		return (
			character.isFemale() &&
			(actor.authoritative?.womb.amount ?? actor.womb?.amount ?? 0) > 0 &&
			!new FluidContainerApi(item).isFull()
		);
	},
	BreastFeedBaby: (_item, character) =>
		character.isFemale() &&
		resolveRecipeLactation(readRecipeActorState(character)).milkAmount >= RECIPE_BOTTLE_AMOUNT,
	BottleFeedBaby: (item, character) => {
		if (!character.isFemale() || !character.getInventory().contains(ITEMS.BABY)) return false;
		const container = new FluidContainerApi(item);
		return (
			container.primaryFluid === Fluids.HUMAN_MILK && container.amount >= RECIPE_BOTTLE_AMOUNT
		);
	}
};

/** Shared recipe callback registry discovered by Build 42 craft recipes. */
declare let BFRecipes: { OnTest?: Record<string, RecipeTest> };
BFRecipes = BFRecipes ?? {};
BFRecipes.OnTest = BFRecipeTests;
