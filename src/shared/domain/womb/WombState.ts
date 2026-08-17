/** Server-persisted reversible Womb state. */
export type AuthoritativeWombState = {
	/** Current cycle day; negative values represent postpartum recovery. */
	cycleDay?: number;
	/** Current sperm volume retained by the player. */
	amount?: number;
	/** Cumulative sperm volume received by the player. */
	total?: number;
	/** Whether the current cycle is protected by contraceptive medication. */
	onContraceptive?: boolean;
};

/** Concrete reversible Womb state published after legacy local data is initialized. */
export type WombProgressState = {
	/** Current menstrual cycle or postpartum recovery day. */
	cycleDay: number;
	/** Current sperm volume retained by the player. */
	amount: number;
	/** Cumulative sperm volume received by the player. */
	total: number;
	/** Whether contraceptive medication is active for this cycle. */
	onContraceptive?: boolean;
};

/** Creates an uninitialized Womb state that preserves legacy data during migration. */
export const createDefaultWombState = (): AuthoritativeWombState => ({});
