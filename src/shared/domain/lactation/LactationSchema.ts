import { boolean, number, object } from "@shared/validation/Schema";
import type { LactationState } from "@shared/domain/lactation/LactationState";

/** Runtime validator for complete persisted Lactation state. */
export const lactationStateSchema = object<LactationState>({
	isActive: boolean,
	milkAmount: number({ minimum: 0 }),
	expiration: number({ minimum: 0 }),
	multiplier: number({ minimum: 0 })
});
