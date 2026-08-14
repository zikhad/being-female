import type { AuthoritativeWombState, WombProgressState } from "@shared/domain/womb/WombState";
import { integer, number, object, optional } from "@shared/validation/Schema";

/** Valid recovery and menstrual-cycle range supported by the current Womb model. */
const cycleDay = integer({ minimum: -56, maximum: 28 });
/** Maximum sperm volume supported by the declared Womb capacity sandbox range. */
const amount = number({ minimum: 0, maximum: 3 });
/** Valid cumulative sperm volume. */
const total = number({ minimum: 0 });

/** Runtime schema for persisted and replicated Womb state. */
export const wombStateSchema = object<AuthoritativeWombState>({
	cycleDay: optional(cycleDay),
	amount: optional(amount),
	total: optional(total)
});

/** Runtime schema for concrete client-published reversible Womb state. */
export const wombProgressStateSchema = object<WombProgressState>({
	cycleDay,
	amount,
	total
});
