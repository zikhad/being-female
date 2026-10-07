import type { LactationState } from "@shared/domain/lactation/LactationState";

/** Initial lactation balance values shared by simulation and authoritative recipes. */
export const LACTATION_BALANCE = {
	BASE_RATE_MIN: 0.00035,
	BASE_RATE_MAX: 0.0007,
	STIMULATION_PER_LITER_REMOVED: 1.25,
	LACTAID_STIMULATION: 0.25,
	MAX_STIMULATION: 0.5,
	STIMULATION_DECAY_PER_HOUR: 0.025,
	DAIRY_COW_FACTOR: 1.25,
	COST_PER_LITER: {
		calories: 640,
		carbohydrates: 32,
		lipids: 32,
		proteins: 16,
		thirst: 0.2
	}
} as const;

/** Metabolic costs caused by producing an exact volume of milk. */
export type LactationMetabolicCost = {
	calories: number;
	carbohydrates: number;
	lipids: number;
	proteins: number;
	thirst: number;
};

/** Clamps persisted or calculated recent-demand stimulation to its supported range. */
export const clampStimulation = (value: number): number =>
	Math.min(LACTATION_BALANCE.MAX_STIMULATION, Math.max(0, value));

/** Returns the production factor for the player's current thirst value. */
export const hydrationFactor = (thirst: number): number =>
	Math.max(0.25, 1 - 0.75 * Math.max(0, thirst));

/** Returns the production factor for the player's current hunger value. */
export const hungerFactor = (hunger: number): number =>
	Math.max(0.5, 1 - 0.5 * Math.max(0, hunger));

/** Adds recent-demand stimulation for milk actually removed from the character. */
export const addRemovalStimulation = (current: number, removedLiters: number): number =>
	clampStimulation(
		clampStimulation(current) +
			Math.max(0, removedLiters) * LACTATION_BALANCE.STIMULATION_PER_LITER_REMOVED
	);

/** Adds the deterministic stimulation supplied by Lactaid. */
export const addLactaidStimulation = (current: number): number =>
	clampStimulation(clampStimulation(current) + LACTATION_BALANCE.LACTAID_STIMULATION);

/** Decays recent-demand stimulation for elapsed game time. */
export const decayStimulation = (current: number, elapsedMinutes: number): number =>
	clampStimulation(
		clampStimulation(current) -
			(Math.max(0, elapsedMinutes) / 60) * LACTATION_BALANCE.STIMULATION_DECAY_PER_HOUR
	);

/** Calculates the active duration, applying Dairy Cow exactly once. */
export const lactationDuration = (baseHours: number, hasDairyCow: boolean): number =>
	Math.max(0, baseHours) * (hasDairyCow ? LACTATION_BALANCE.DAIRY_COW_FACTOR : 1);

/** Calculates requested milk production before breast-capacity clamping. */
export const requestedProduction = ({
	baseRatePerMinute,
	elapsedMinutes,
	stimulation,
	hasDairyCow,
	thirst,
	hunger
}: {
	baseRatePerMinute: number;
	elapsedMinutes: number;
	stimulation: number;
	hasDairyCow: boolean;
	thirst: number;
	hunger: number;
}): number =>
	Math.max(0, baseRatePerMinute) *
	Math.max(0, elapsedMinutes) *
	(1 + clampStimulation(stimulation)) *
	(hasDairyCow ? LACTATION_BALANCE.DAIRY_COW_FACTOR : 1) *
	hydrationFactor(thirst) *
	hungerFactor(hunger);

/** Calculates proportional metabolic costs for milk actually produced. */
export const metabolicCostFor = (producedLiters: number): LactationMetabolicCost => {
	const liters = Math.max(0, producedLiters);
	return {
		calories: liters * LACTATION_BALANCE.COST_PER_LITER.calories,
		carbohydrates: liters * LACTATION_BALANCE.COST_PER_LITER.carbohydrates,
		lipids: liters * LACTATION_BALANCE.COST_PER_LITER.lipids,
		proteins: liters * LACTATION_BALANCE.COST_PER_LITER.proteins,
		thirst: liters * LACTATION_BALANCE.COST_PER_LITER.thirst
	};
};

/**
 * Removes milk, adds demand from the actual removal, and optionally refreshes duration.
 */
export const applyMilkRemoval = (
	state: LactationState,
	requestedLiters: number,
	refreshedDuration?: number
): LactationState => {
	const removed = Math.min(Math.max(0, requestedLiters), state.milkAmount);
	return {
		...state,
		milkAmount: state.milkAmount - removed,
		expiration:
			removed > 0 && refreshedDuration !== undefined ? refreshedDuration : state.expiration,
		multiplier: addRemovalStimulation(state.multiplier, removed)
	};
};
