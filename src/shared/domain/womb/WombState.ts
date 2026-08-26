/** Server-persisted reversible Womb state. */
export type AuthoritativeWombState = {
	/** Current cycle day; negative values represent postpartum recovery. */
	cycleDay: number;
	/** Current sperm volume retained by the player. */
	amount: number;
	/** Cumulative sperm volume received by the player. */
	total: number;
	/** Whether the current cycle is protected by contraceptive medication. */
	onContraceptive: boolean;
};

/** Concrete reversible Womb state published after component-local data is initialized. */
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

/** Creates the neutral complete Womb state for a fresh authoritative root. */
export const createDefaultWombState = (): AuthoritativeWombState => ({
	cycleDay: 1,
	amount: 0,
	total: 0,
	onContraceptive: false
});
