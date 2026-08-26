import {
	AuthoritativePregnancyState,
	PregnancyStatus
} from "@shared/domain/pregnancy/PregnancyState";
import { boolean, nonNegativeInteger, number, object, oneOf } from "@shared/validation/Schema";

/** Runtime schema for persisted and networked Pregnancy domain state. */
export const pregnancyStateSchema = object<AuthoritativePregnancyState>({
	status: oneOf<PregnancyStatus>([PregnancyStatus.NOT_PREGNANT, PregnancyStatus.PREGNANT]),
	current: nonNegativeInteger,
	progress: number({ minimum: 0, maximum: 1 }),
	isInLabor: boolean
});
