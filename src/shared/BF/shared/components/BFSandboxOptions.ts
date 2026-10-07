/** Default configured lactation duration in days. */
const DEFAULT_LACTATION_DURATION_DAYS = 7;

/**
 * Reads the configured base lactation duration in hours in any Lua execution context.
 *
 * @returns Configured MilkExpiration days converted to game hours.
 */
export const configuredLactationDurationHours = (): number => {
	const globals = globalThis as { SandboxVars?: { BF?: BFSandboxOptions } };
	return (globals.SandboxVars?.BF?.MilkExpiration ?? DEFAULT_LACTATION_DURATION_DAYS) * 24;
};
