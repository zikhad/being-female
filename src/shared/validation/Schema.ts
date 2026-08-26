/** Runtime type guard used to validate values that cross untrusted boundaries. */
export type Validator<T> = (value: unknown) => value is T;

/** Numeric bounds accepted by an integer validator. */
export type IntegerOptions = {
	/** Inclusive minimum accepted value. */
	minimum?: number;
	/** Inclusive maximum accepted value. */
	maximum?: number;
};

/** Numeric bounds accepted by a finite-number validator. */
export type NumberOptions = IntegerOptions;

/** String-length bounds accepted by a string validator. */
export type StringOptions = {
	/** Inclusive minimum string length. */
	minimumLength?: number;
	/** Inclusive maximum string length. */
	maximumLength?: number;
};

/** Validates that a runtime value is a non-null Lua table/object. */
export const record: Validator<Record<string, unknown>> = (
	value: unknown
): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** Validates a runtime boolean value. */
export const boolean: Validator<boolean> = (value: unknown): value is boolean =>
	typeof value === "boolean";

/**
 * Creates a validator for finite numbers within optional inclusive bounds.
 *
 * @param options Optional minimum and maximum values.
 * @returns Validator for bounded finite numbers.
 */
export const number = ({ minimum, maximum }: NumberOptions = {}): Validator<number> => {
	return (value: unknown): value is number => {
		if (typeof value !== "number" || !Number.isFinite(value)) return false;
		if (minimum !== undefined && value < minimum) return false;
		if (maximum !== undefined && value > maximum) return false;
		return true;
	};
};

/**
 * Creates a validator for finite integers within optional inclusive bounds.
 *
 * @param options Optional minimum and maximum values.
 * @returns Validator for bounded finite integers.
 */
export const integer = ({ minimum, maximum }: IntegerOptions = {}): Validator<number> => {
	return (value: unknown): value is number => {
		if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
			return false;
		}
		if (minimum !== undefined && value < minimum) return false;
		if (maximum !== undefined && value > maximum) return false;
		return true;
	};
};

/** Validates any finite integer. */
export const finiteInteger = integer();

/** Validates a finite integer greater than or equal to zero. */
export const nonNegativeInteger = integer({ minimum: 0 });

/** Validates a finite integer greater than zero. */
export const positiveInteger = integer({ minimum: 1 });

/**
 * Creates a validator for a field that may be absent from a Lua table.
 *
 * @param validator Validator used when the field is present.
 * @returns Validator accepting either an absent value or the supplied value shape.
 */
export const optional = <T>(validator: Validator<T>): Validator<T | undefined> => {
	return (value: unknown): value is T | undefined => value === undefined || validator(value);
};

/**
 * Creates a validator for strings within optional inclusive length bounds.
 *
 * @param options Optional minimum and maximum string lengths.
 * @returns Validator for bounded strings.
 */
export const string = ({ minimumLength, maximumLength }: StringOptions = {}): Validator<string> => {
	return (value: unknown): value is string => {
		if (typeof value !== "string") return false;
		if (minimumLength !== undefined && value.length < minimumLength) return false;
		if (maximumLength !== undefined && value.length > maximumLength) return false;
		return true;
	};
};

/**
 * Creates a validator that accepts one value from a fixed set.
 *
 * @param values Supported literal or enum values.
 * @returns Validator for members of the supplied set.
 */
export const oneOf = <T>(values: readonly T[]): Validator<T> => {
	return (value: unknown): value is T => {
		for (const supported of values) {
			if (value === supported) return true;
		}
		return false;
	};
};

/** Validates a Lua table/object that contains no keys. */
export const emptyRecord: Validator<Record<string, never>> = (
	value: unknown
): value is Record<string, never> => record(value) && Object.keys(value).length === 0;

/**
 * Creates a validator for a nested object shape.
 * Unknown additional fields are allowed so schema-versioned envelopes remain forward-compatible.
 *
 * @param shape Validator for every required property.
 * @returns Validator for objects containing the required validated properties.
 */
export const object = <T extends object>(shape: {
	[K in keyof T]: Validator<T[K]>;
}): Validator<T> => {
	return (value: unknown): value is T => {
		if (!record(value)) return false;

		const keys = Object.keys(shape) as Array<keyof T>;
		for (const key of keys) {
			const validate = shape[key];
			if (!validate(value[key as string])) return false;
		}

		return true;
	};
};
