/** Server-authoritative lifecycle status for the Pregnancy domain. */
export enum PregnancyStatus {
	NOT_PREGNANT = "notPregnant",
	PREGNANT = "pregnant"
}

/** Persisted and replicated Pregnancy domain state. */
export type AuthoritativePregnancyState = {
	/** Current lifecycle status. */
	status: PregnancyStatus;
	/** Elapsed pregnancy time in in-game minutes. */
	current: number;
	/** Normalized pregnancy completion from zero through one. */
	progress: number;
	/** Whether the authoritative state has reached labor. */
	isInLabor: boolean;
};

/** Creates the default non-pregnant authoritative state. */
export const createDefaultPregnancyState = (): AuthoritativePregnancyState => ({
	status: PregnancyStatus.NOT_PREGNANT,
	current: 0,
	progress: 0,
	isInLabor: false
});
