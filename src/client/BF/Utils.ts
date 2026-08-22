/**
 * Formats a fractional value in liters as a string in milliliters (ml).
 * Rounds to the nearest integer.
 *
 * @param value - The value in liters (e.g., 0.25 for 250ml).
 * @returns The formatted string, e.g., "250 ml".
 */
export const valueInMilliliters = (value: number): string => `${Math.round(value * 1000)} ml`;
/**
 * Given a percentage and an arbitrary number, returns the corresponding number between 0 and the number
 * @param percentage the percentage to be converted into an arbirary number
 * @param maxNumber the number that represents the Max
 * @returns
 */
export const percentageToNumber = (percentage: number, maxNumber: number) => {
	percentage = Math.min(100, percentage);
	percentage = Math.max(0, percentage);
	return Math.floor((percentage / 100) * maxNumber);
};

/**
 * Applies a positive delta to a value with optional upper bound,
 * ensuring the result never decreases below the current value.
 *
 * This is the core invariant for effect application:
 * - Values are only increased (never reduced)
 * - A delta is added to the current value
 * - The result can be capped by `max` if provided
 *
 * @param current - The current value.
 * @param delta - The amount to add. Negative values are effectively ignored.
 * @param max - Optional upper bound for the resulting value.
 * @returns The updated value, guaranteed to be >= current.
 */
export const increaseClamped = (current: number, delta: number, max?: number): number => {
	const next = current + Math.max(0, delta);
	const bounded = max !== undefined ? Math.min(max, next) : next;
	return Math.max(current, bounded);
};
/**
 * Repeats a frame sequence a fixed number of times using TSTL-safe loops.
 * @param steps The sequence of frame indices to repeat.
 * @param times The number of times to repeat the sequence.
 * @returns A new array with the repeated sequence.
 * @remarks This function is necessary because TSTL does not support certain array methods like `new Array(times)`.
 */
export const repeatArray = (steps: number[], times: number): number[] => {
	const result: number[] = [];
	for (let i = 0; i < times; i++) {
		for (const step of steps) {
			result.push(step);
		}
	}
	return result;
};

/**
 * Creates an array of sequential numbers from 0 to length - 1.
 * @param length  The length of the array to create.
 * @returns An array containing numbers from 0 to length - 1.
 */
export const createArray = (length: number) => {
	const steps: number[] = [];
	for (let index = 0; index < length; index++) {
		steps.push(index);
	}
	return steps;
};

/**
 * Trims the module prefix from an item name.
 * For example, "BF.Condom" becomes "Condom".
 * @param name The full name with module prefix.
 * @returns The trimmed item name without the module prefix.
 */
export const trimModuleName = (name: string): string => {
	const parts = name.split(".");
	return parts[parts.length - 1];
};
