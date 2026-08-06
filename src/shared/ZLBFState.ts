import type { AuthoritativePregnancyState } from "@shared/domain/pregnancy/PregnancyState";

/** Authoritative domain collection persisted by the server and mirrored to clients. */
export type AuthoritativeDomains = {
	/** Current authoritative Pregnancy domain state. */
	pregnancy: AuthoritativePregnancyState;
};
