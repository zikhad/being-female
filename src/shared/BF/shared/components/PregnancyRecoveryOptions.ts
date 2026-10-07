import { integer } from "@shared/validation/Schema";

/** Result of reading the mutable global Pregnancy recovery sandbox option. */
export type PregnancyRecoveryOption = {
	/** Recovery duration in in-game days. */
	days: number;
	/** Whether the declared default replaced a missing or invalid runtime value. */
	usedFallback: boolean;
};

/** Reads and validates Pregnancy recovery configuration in client or server Lua. */
export class PregnancyRecoveryOptions {
	private static readonly defaultDays = 7;
	private static readonly validDays = integer({ minimum: 0, maximum: 56 });

	/**
	 * Reads the current sandbox value without caching live administrative changes.
	 *
	 * @returns Valid configured days or the declaration default with fallback metadata.
	 */
	public read(): PregnancyRecoveryOption {
		const globals = globalThis as { SandboxVars?: { BF?: BFSandboxOptions } };
		const value = globals.SandboxVars?.BF?.PregnancyRecovery;
		return PregnancyRecoveryOptions.validDays(value)
			? { days: value, usedFallback: false }
			: { days: PregnancyRecoveryOptions.defaultDays, usedFallback: true };
	}
}
