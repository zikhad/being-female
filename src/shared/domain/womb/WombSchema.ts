import type { AuthoritativeWombState, WombCycleState } from "@shared/domain/womb/WombState";
import { integer, object, optional } from "@shared/validation/Schema";

/** Valid recovery and menstrual-cycle range supported by the current Womb model. */
const cycleDay = integer({ minimum: -56, maximum: 28 });

/** Runtime schema for persisted and replicated Womb state. */
export const wombStateSchema = object<AuthoritativeWombState>({
	cycleDay: optional(cycleDay)
});

/** Runtime schema for a concrete client-published Womb cycle state. */
export const wombCycleStateSchema = object<WombCycleState>({ cycleDay });
