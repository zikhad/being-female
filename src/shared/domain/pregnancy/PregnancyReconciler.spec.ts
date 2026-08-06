import {
	createDefaultPregnancyState,
	PregnancyStatus
} from "@shared/domain/pregnancy/PregnancyState";
import { PregnancyReconciler } from "@shared/domain/pregnancy/PregnancyReconciler";

describe("PregnancyReconciler", () => {
	const reconciler = new PregnancyReconciler();

	it("returns an immutable changed state for a valid transition", () => {
		const current = createDefaultPregnancyState();
		const desired = { ...current, status: PregnancyStatus.PREGNANT };

		const result = reconciler.reconcile(current, desired);

		expect(result).toEqual({ valid: true, changed: true, state: desired });
		expect(result.state).not.toBe(desired);
		expect(current.status).toBe(PregnancyStatus.NOT_PREGNANT);
	});

	it("is idempotent when desired state already matches", () => {
		const current = createDefaultPregnancyState();
		expect(reconciler.reconcile(current, { ...current })).toEqual({
			valid: true,
			changed: false,
			state: current
		});
	});

	it.each([
		{
			status: PregnancyStatus.NOT_PREGNANT,
			current: 1,
			progress: 0,
			isInLabor: false
		},
		{
			status: PregnancyStatus.PREGNANT,
			current: 0,
			progress: 0.5,
			isInLabor: false
		},
		{
			status: PregnancyStatus.PREGNANT,
			current: 10,
			progress: 0.5,
			isInLabor: true
		}
	])("rejects inconsistent desired state %#", desired => {
		const current = createDefaultPregnancyState();
		expect(reconciler.reconcile(current, desired)).toEqual({
			valid: false,
			changed: false,
			state: current
		});
	});
});
