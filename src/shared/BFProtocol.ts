import { BFSyncStatus } from "@constants";
import {
	emptyRecord,
	nonNegativeInteger,
	object,
	oneOf,
	positiveInteger,
	string
} from "@shared/validation/Schema";
import type { AuthoritativeDomains } from "@shared/BFState";
import { pregnancyStateSchema } from "@shared/domain/pregnancy/PregnancySchema";
import type { AuthoritativePregnancyState } from "@shared/domain/pregnancy/PregnancyState";
import { birthStateSchema } from "@shared/domain/birth/BirthSchema";
import { wombProgressStateSchema, wombStateSchema } from "@shared/domain/womb/WombSchema";
import type { WombProgressState } from "@shared/domain/womb/WombState";
import { lactationStateSchema } from "@shared/domain/lactation/LactationSchema";
import type { LactationState } from "@shared/domain/lactation/LactationState";

/** Metadata shared by every request and response in the BF sync protocol. */
type BFEnvelopeMetadata = {
	/** Version of the network envelope understood by the sender. */
	schemaVersion: number;
	/** Client-generated identifier used to correlate one request and response. */
	requestId: string;
	/** Monotonically increasing client-local request number. */
	revision: number;
};

/** Read-only request for the server's current authoritative BF snapshot metadata. */
export type BFSyncStateRequest = BFEnvelopeMetadata & {
	/** Reserved command payload; it must remain empty for this protocol version. */
	data: Record<string, never>;
};

/** Version metadata describing the server's authoritative BF state. */
export type BFSnapshot = {
	/** Version of the persisted domain-data shape. */
	schemaVersion: number;
	/** Server-owned revision of the authoritative state. */
	stateVersion: number;
	/** Server-authoritative gameplay domains mirrored to the client. */
	domains: AuthoritativeDomains;
};

/** Targeted server response correlated to a {@link BFSyncStateRequest}. */
export type BFSyncStateResponse = BFEnvelopeMetadata & {
	/** Outcome of validating and handling the request. */
	status: BFSyncStatus;
	/** Read-only authoritative snapshot returned by the server. */
	data: { snapshot: BFSnapshot };
};

/** Debug-only request to replace the authenticated player's Pregnancy domain state. */
export type BFSetPregnancyStateRequest = BFEnvelopeMetadata & {
	/** Desired Pregnancy state subject to server schema and invariant validation. */
	data: { desired: AuthoritativePregnancyState };
};

/** Authoritative snapshot response to a Pregnancy debug mutation request. */
export type BFSetPregnancyStateResponse = BFSyncStateResponse;

/** Normal progression publication for the authenticated player's Pregnancy domain. */
export type BFPublishPregnancyStateRequest = BFSetPregnancyStateRequest;

/** Authoritative snapshot response to a Pregnancy progression publication. */
export type BFPublishPregnancyStateResponse = BFSyncStateResponse;

/** Request to allocate or recover the authenticated player's pending birth operation. */
export type BFAllocateBirthRequest = BFSyncStateRequest;

/** Authoritative snapshot containing the allocated pending birth identity. */
export type BFAllocateBirthResponse = BFSyncStateResponse;

/** Request to complete one previously allocated birth operation. */
export type BFCompleteBirthRequest = BFEnvelopeMetadata & {
	/** Server-issued identity returned by birth allocation. */
	data: { birthId: string };
};

/** Authoritative snapshot returned after birth completion or an idempotent retry. */
export type BFCompleteBirthResponse = BFSyncStateResponse;

/** Publishes the owning client's reversible menstrual-cycle progression. */
export type BFPublishWombStateRequest = BFEnvelopeMetadata & {
	/** Authoritative version on which the desired transition was calculated. */
	baseStateVersion: number;
	/** Desired concrete Womb cycle state. */
	data: { desired: WombProgressState };
};

/** Authoritative snapshot returned after Womb progression publication. */
export type BFPublishWombStateResponse = BFSyncStateResponse;

/** Publishes complete client-simulated Lactation state against one authoritative base. */
export type BFPublishLactationStateRequest = BFEnvelopeMetadata & {
	/** Authoritative version on which the complete desired state was calculated. */
	baseStateVersion: number;
	/** Complete desired Lactation state. */
	data: { desired: LactationState };
};

/** Authoritative snapshot returned after Lactation publication or conflict. */
export type BFPublishLactationStateResponse = BFSyncStateResponse;

/** Validator for bounded client-generated request identifiers. */
const requestId = string({ minimumLength: 1, maximumLength: 64 });
/** Validator for every status understood by this protocol version. */
const syncStatus = oneOf<BFSyncStatus>([
	BFSyncStatus.OK,
	BFSyncStatus.INVALID_REQUEST,
	BFSyncStatus.UNSUPPORTED_SCHEMA,
	BFSyncStatus.UNSUPPORTED_DATA_SCHEMA,
	BFSyncStatus.FORBIDDEN
]);
/** Runtime schema for authoritative snapshot metadata. */
const snapshotSchema = object<BFSnapshot>({
	schemaVersion: positiveInteger,
	stateVersion: nonNegativeInteger,
	domains: object<AuthoritativeDomains>({
		pregnancy: pregnancyStateSchema,
		birth: birthStateSchema,
		womb: wombStateSchema,
		lactation: lactationStateSchema
	})
});
/** Runtime schema for untrusted sync-state requests. */
const requestSchema = object<BFSyncStateRequest>({
	schemaVersion: positiveInteger,
	requestId,
	revision: positiveInteger,
	data: emptyRecord
});
/** Runtime schema for untrusted sync-state responses. */
const responseSchema = object<BFSyncStateResponse>({
	schemaVersion: positiveInteger,
	requestId,
	revision: positiveInteger,
	status: syncStatus,
	data: object<BFSyncStateResponse["data"]>({ snapshot: snapshotSchema })
});
/** Runtime schema for untrusted Pregnancy debug mutation requests. */
const setPregnancyStateRequestSchema = object<BFSetPregnancyStateRequest>({
	schemaVersion: positiveInteger,
	requestId,
	revision: positiveInteger,
	data: object<BFSetPregnancyStateRequest["data"]>({ desired: pregnancyStateSchema })
});
/** Runtime schema for an untrusted birth-completion request. */
const completeBirthRequestSchema = object<BFCompleteBirthRequest>({
	schemaVersion: positiveInteger,
	requestId,
	revision: positiveInteger,
	data: object<BFCompleteBirthRequest["data"]>({
		birthId: string({ minimumLength: 1, maximumLength: 128 })
	})
});
/** Runtime schema for an untrusted Womb progression publication. */
const publishWombStateRequestSchema = object<BFPublishWombStateRequest>({
	schemaVersion: positiveInteger,
	requestId,
	revision: positiveInteger,
	baseStateVersion: nonNegativeInteger,
	data: object<BFPublishWombStateRequest["data"]>({ desired: wombProgressStateSchema })
});
/** Runtime schema for an untrusted complete Lactation publication. */
const publishLactationStateRequestSchema = object<BFPublishLactationStateRequest>({
	schemaVersion: positiveInteger,
	requestId,
	revision: positiveInteger,
	baseStateVersion: nonNegativeInteger,
	data: object<BFPublishLactationStateRequest["data"]>({ desired: lactationStateSchema })
});

/**
 * Validates an untrusted client-command payload before server code reads it.
 *
 * @param value Raw value received from Project Zomboid's client-command event.
 * @returns Whether the value is a structurally valid sync-state request.
 */
export const isBFSyncStateRequest = requestSchema;

/**
 * Validates an untrusted server-command payload before client code reads it.
 *
 * @param response Raw value received from Project Zomboid's server-command event.
 * @returns Whether the value is a structurally valid sync-state response.
 */
export const isBFSyncStateResponse = responseSchema;

/**
 * Validates an untrusted Pregnancy debug mutation payload.
 *
 * @param value Raw value received from Project Zomboid's client-command event.
 * @returns Whether the value is a structurally valid Pregnancy mutation request.
 */
export const isBFSetPregnancyStateRequest = setPregnancyStateRequestSchema;

/** Validates a Pregnancy mutation response, which uses the standard snapshot envelope. */
export const isBFSetPregnancyStateResponse = responseSchema;

/** Validates a normal Pregnancy progression publication payload. */
export const isBFPublishPregnancyStateRequest = setPregnancyStateRequestSchema;

/** Validates a Pregnancy progression response using the standard snapshot envelope. */
export const isBFPublishPregnancyStateResponse = responseSchema;

/** Validates a birth-allocation request, which carries no client-selected domain data. */
export const isBFAllocateBirthRequest = requestSchema;

/** Validates a birth-allocation response using the standard snapshot envelope. */
export const isBFAllocateBirthResponse = responseSchema;

/** Validates a request to complete a server-issued birth operation. */
export const isBFCompleteBirthRequest = completeBirthRequestSchema;

/** Validates a birth-completion response using the standard snapshot envelope. */
export const isBFCompleteBirthResponse = responseSchema;

/** Validates client-published reversible Womb cycle progression. */
export const isBFPublishWombStateRequest = publishWombStateRequestSchema;

/** Validates a Womb progression response using the standard snapshot envelope. */
export const isBFPublishWombStateResponse = responseSchema;

/** Validates complete client-simulated Lactation publication. */
export const isBFPublishLactationStateRequest = publishLactationStateRequestSchema;

/** Validates a Lactation publication response using the standard snapshot envelope. */
export const isBFPublishLactationStateResponse = responseSchema;
