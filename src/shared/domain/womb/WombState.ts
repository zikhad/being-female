/** Server-persisted reversible menstrual-cycle state. */
export type AuthoritativeWombState = {
	/** Current cycle day; negative values represent postpartum recovery. */
	cycleDay?: number;
};

/** Client publication shape after a concrete cycle day exists. */
export type WombCycleState = {
	/** Current menstrual cycle or postpartum recovery day. */
	cycleDay: number;
};

/** Creates an uninitialized Womb state that preserves legacy data during migration. */
export const createDefaultWombState = (): AuthoritativeWombState => ({});
