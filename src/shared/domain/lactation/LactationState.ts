/** Complete reversible Lactation state persisted for one player. */
export type LactationState = {
	/** Whether milk production is currently active. */
	isActive: boolean;
	/** Current stored milk volume in liters. */
	milkAmount: number;
	/** Remaining active duration in hours. */
	expiration: number;
	/** Temporary recent-demand production stimulation, behaviorally clamped to 0..0.5. */
	multiplier: number;
};

/** Creates the neutral Lactation state for a fresh authoritative root. */
export const createDefaultLactationState = (): LactationState => ({
	isActive: false,
	milkAmount: 0,
	expiration: 0,
	multiplier: 0
});
