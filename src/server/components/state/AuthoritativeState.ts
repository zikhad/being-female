import type { AuthoritativeDomains } from "@shared/ZLBFState";

/** Root value stored under the ZLBF key in an authenticated player's ModData. */
export type AuthoritativeState = {
	/** Version of the persisted root and domain-data shape. */
	dataSchemaVersion: number;
	/** Server-owned revision incremented only after successful domain mutations. */
	stateVersion: number;
	/** Reserved container for authoritative gameplay domains introduced by later slices. */
	domains: AuthoritativeDomains;
};

/** Successful result containing a normalized authoritative root. */
export type SupportedStateLoadResult = {
	/** Discriminator indicating that the state can be used by this mod version. */
	supported: true;
	/** Schema version reported to the requesting client. */
	dataSchemaVersion: number;
	/** Current server-owned state revision. */
	stateVersion: number;
	/** Complete normalized authoritative state. */
	state: AuthoritativeState;
};

/** Result describing a future persisted schema that must not be overwritten. */
export type UnsupportedStateLoadResult = {
	/** Discriminator indicating that the state cannot be used by this mod version. */
	supported: false;
	/** Future schema version found in ModData. */
	dataSchemaVersion: number;
	/** Persisted state revision, or zero when malformed. */
	stateVersion: number;
};

/** Result of loading and interpreting the persisted authoritative root. */
export type StateLoadResult = SupportedStateLoadResult | UnsupportedStateLoadResult;
