/**
 * Sandbox options for BF configuration.
 * The game loads custom sandbox options from sandbox-options.txt into SandboxVars.BF.
 * This module reads those values directly and falls back to defaults when unavailable.
 */

const DEFAULT_OPTIONS = {
	pregnancy: {
		duration: 14, // 14 days in minutes
		recovery: 7 // days
	},
	womb: {
		capacity: 1 // L
	},
	milk: {
		expiration: 7, // 7 days in hours
		capacity: 1 // L
	}
};

/**
 * Base class for accessing sandbox options with type safety and default fallbacks.
 */
abstract class SandboxOptions {
	/**
	 * Utility method to safely access nested sandbox options with fallback to defaults.
	 * @param selector Function to select the desired option from BFSandboxOptions
	 * @param fallback Default value to use if the option is not set in SandboxVars
	 * @returns The value from SandboxVars if available, otherwise the provided fallback
	 */
	getOption<T extends number | string>(
		selector: (options: BFSandboxOptions) => T | undefined,
		fallback: T
	): T {
		const globals = globalThis as { SandboxVars?: { BF?: BFSandboxOptions } };
		const value = selector(globals.SandboxVars?.BF ?? {});
		return value ?? fallback;
	}
}

/**
 * Pregnancy-specific sandbox options.
 */
class PregnancyOptionsClass extends SandboxOptions {
	/**
	 * Duration of pregnancy in minutes.
	 * Default: 14 days (20,160 minutes)
	 */
	get duration(): number {
		const days = this.getOption<number>(
			options => options.PregnancyDuration,
			DEFAULT_OPTIONS.pregnancy.duration
		);
		return days * 24 * 60; // Convert days to minutes;
	}

	/**
	 * Recovery time after pregnancy in days.
	 * Default: 7 days
	 */
	get recovery(): number {
		return this.getOption<number>(
			options => options.PregnancyRecovery,
			DEFAULT_OPTIONS.pregnancy.recovery
		);
	}
}

/**
 * Womb-specific sandbox options.
 */
class WombOptionsClass extends SandboxOptions {
	/**
	 * Maximum capacity of the womb in liters.
	 * Default: 1 L
	 */
	get capacity(): number {
		return this.getOption<number>(
			options => options.WombMaxCapacity,
			DEFAULT_OPTIONS.womb.capacity
		);
	}

	/**
	 * Recovery time after pregnancy in days.
	 * Default: 7 days
	 */
	get recovery(): number {
		return this.getOption<number>(
			options => options.PregnancyRecovery,
			DEFAULT_OPTIONS.pregnancy.recovery
		);
	}
}

/**
 * Milk-specific sandbox options.
 */
class LactationOptionsClass extends SandboxOptions {
	/**
	 * Maximum capacity for milk storage in liters.
	 * Default: 1 L
	 */
	get capacity(): number {
		return this.getOption<number>(
			options => options.MilkCapacity,
			DEFAULT_OPTIONS.milk.capacity
		);
	}

	/**
	 * Days before milk expires.
	 * Default: 7 days
	 */
	get expiration(): number {
		const days = this.getOption<number>(
			options => options.MilkExpiration,
			DEFAULT_OPTIONS.milk.expiration
		);
		return days * 24; // Convert days to hours
	}
}

export const PregnancyOptions = new PregnancyOptionsClass();
export const WombOptions = new WombOptionsClass();
export const LactationOptions = new LactationOptionsClass();
