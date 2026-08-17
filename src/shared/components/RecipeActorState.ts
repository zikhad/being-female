import { isServer, type IsoGameCharacter } from "@asledgehammer/pipewrench";
import type { LactationState } from "@shared/domain/lactation/LactationState";
import type { PregnancyData, WombData } from "@types";
import { lactationStateSchema } from "@shared/domain/lactation/LactationSchema";
import { ZLBF_STATE_MOD_DATA_KEY } from "@constants";
import type { AuthoritativeDomains } from "@shared/ZLBFState";
import { createDefaultLactationState } from "@shared/domain/lactation/LactationState";

/** Legacy player ModData fields consumed by recipe eligibility and SP mutations. */
export type RecipeActorState = {
	/** Existing Womb component state, when initialized. */
	womb?: WombData;
	/** Existing Lactation component state, when initialized. */
	lactation?: LactationState;
	/** Existing Pregnancy component state, when initialized. */
	pregnancy?: PregnancyData;
	/** Existing authoritative domains, when the current root is initialized. */
	authoritative?: AuthoritativeDomains;
};

/**
 * Reads recipe state exclusively from the callback-supplied character.
 *
 * @param character Callback actor whose ModData should be inspected without mutation.
 * The namespaced root is server-owned and is deliberately ignored in client and
 * single-player callback contexts, where it may be an unsynchronized stale copy.
 *
 * @returns Legacy recipe fields plus the authoritative domain root on the server.
 */
export const readRecipeActorState = (character: IsoGameCharacter): RecipeActorState => {
	const data = (character.getModData() ?? {}) as unknown as Record<string, unknown>;
	const root = data[ZLBF_STATE_MOD_DATA_KEY] as { domains?: AuthoritativeDomains } | undefined;
	const authoritative = typeof isServer === "function" && isServer() ? root?.domains : undefined;
	return {
		womb: data.ZLBFWomb as WombData | undefined,
		lactation: lactationStateSchema(data.ZLBFLactation) ? data.ZLBFLactation : undefined,
		pregnancy: data.ZLBFPregnancy as PregnancyData | undefined,
		authoritative
	};
};

/**
 * Resolves complete Lactation state with explicit authoritative-over-legacy precedence.
 * A validated authoritative zero state remains authoritative and never falls back merely
 * because every numeric value is zero.
 *
 * @param actor Previously read callback-actor state.
 * @returns Valid authoritative Lactation, valid legacy Lactation, or a neutral default.
 */
export const resolveRecipeLactation = (actor: RecipeActorState): LactationState => {
	const authoritative = actor.authoritative?.lactation;
	if (lactationStateSchema(authoritative)) return authoritative;
	if (actor.lactation) return actor.lactation;
	return createDefaultLactationState();
};
