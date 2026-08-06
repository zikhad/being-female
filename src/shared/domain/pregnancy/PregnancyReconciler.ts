import {
	AuthoritativePregnancyState,
	PregnancyStatus
} from "@shared/domain/pregnancy/PregnancyState";

/** Result of validating and reconciling a desired Pregnancy state. */
export type PregnancyReconciliation = {
	/** Whether the desired state satisfies domain invariants. */
	valid: boolean;
	/** Whether applying the desired state changes authoritative state. */
	changed: boolean;
	/** Next immutable state; current state is returned when invalid or unchanged. */
	state: AuthoritativePregnancyState;
};

/** Pure reconciliation for reversible debug Pregnancy state changes. */
export class PregnancyReconciler {
	/**
	 * Validates domain invariants and calculates an immutable next state.
	 *
	 * @param current Current server-authoritative Pregnancy state.
	 * @param desired Desired state submitted by the debug client command.
	 * @returns Validation, change detection, and the next state.
	 */
	public reconcile(
		current: AuthoritativePregnancyState,
		desired: AuthoritativePregnancyState
	): PregnancyReconciliation {
		if (!this.isConsistent(desired)) return { valid: false, changed: false, state: current };

		const changed =
			current.status !== desired.status ||
			current.current !== desired.current ||
			current.progress !== desired.progress ||
			current.isInLabor !== desired.isInLabor;

		if (!changed) return { valid: true, changed: false, state: current };
		return {
			valid: true,
			changed: true,
			state: {
				status: desired.status,
				current: desired.current,
				progress: desired.progress,
				isInLabor: desired.isInLabor
			}
		};
	}

	/** Checks cross-field Pregnancy invariants not expressible by primitive schemas. */
	private isConsistent(state: AuthoritativePregnancyState): boolean {
		if (state.status === PregnancyStatus.NOT_PREGNANT) {
			return state.current === 0 && state.progress === 0 && !state.isInLabor;
		}
		if (state.progress === 0 && state.current !== 0) return false;
		if (state.progress > 0 && state.current === 0) return false;
		if (state.isInLabor && state.progress !== 1) return false;
		return true;
	}
}
