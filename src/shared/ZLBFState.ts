import {
	AuthoritativePregnancyState,
	createDefaultPregnancyState
} from "@shared/domain/pregnancy/PregnancyState";
import { AuthoritativeBirthState, createDefaultBirthState } from "@shared/domain/birth/BirthState";

/** Authoritative domain collection persisted by the server and mirrored to clients. */
export type AuthoritativeDomains = {
	/** Current authoritative Pregnancy domain state. */
	pregnancy: AuthoritativePregnancyState;
	/** Server-owned allocation and completion bookkeeping for birth operations. */
	birth: AuthoritativeBirthState;
};

/** Creates every authoritative domain with its current default state. */
export const createDefaultDomains = (): AuthoritativeDomains => ({
	pregnancy: createDefaultPregnancyState(),
	birth: createDefaultBirthState()
});
