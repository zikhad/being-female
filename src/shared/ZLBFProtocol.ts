import { ZLBFSyncStatus } from "@constants";
import {
	emptyRecord,
	nonNegativeInteger,
	object,
	oneOf,
	positiveInteger,
	string
} from "@shared/validation/Schema";
import type { AuthoritativeDomains } from "@shared/ZLBFState";
import { pregnancyStateSchema } from "@shared/domain/pregnancy/PregnancySchema";
import type { AuthoritativePregnancyState } from "@shared/domain/pregnancy/PregnancyState";
import { birthStateSchema } from "@shared/domain/birth/BirthSchema";

/** Metadata shared by every request and response in the ZLBF sync protocol. */
type ZLBFEnvelopeMetadata = {
	/** Version of the network envelope understood by the sender. */
	schemaVersion: number;
	/** Client-generated identifier used to correlate one request and response. */
	requestId: string;
	/** Monotonically increasing client-local request number. */
	revision: number;
};

/** Read-only request for the server's current authoritative ZLBF snapshot metadata. */
export type ZLBFSyncStateRequest = ZLBFEnvelopeMetadata & {
	/** Reserved command payload; it must remain empty for this protocol version. */
	data: Record<string, never>;
};

/** Version metadata describing the server's authoritative ZLBF state. */
export type ZLBFSnapshot = {
	/** Version of the persisted domain-data shape. */
	dataSchemaVersion: number;
	/** Server-owned revision of the authoritative state. */
	stateVersion: number;
	/** Server-authoritative gameplay domains mirrored to the client. */
	domains: AuthoritativeDomains;
};

/** Targeted server response correlated to a {@link ZLBFSyncStateRequest}. */
export type ZLBFSyncStateResponse = ZLBFEnvelopeMetadata & {
	/** Outcome of validating and handling the request. */
	status: ZLBFSyncStatus;
	/** Read-only authoritative snapshot returned by the server. */
	data: { snapshot: ZLBFSnapshot };
};

/** Debug-only request to replace the authenticated player's Pregnancy domain state. */
export type ZLBFSetPregnancyStateRequest = ZLBFEnvelopeMetadata & {
	/** Desired Pregnancy state subject to server schema and invariant validation. */
	data: { desired: AuthoritativePregnancyState };
};

/** Authoritative snapshot response to a Pregnancy debug mutation request. */
export type ZLBFSetPregnancyStateResponse = ZLBFSyncStateResponse;

/** Normal progression publication for the authenticated player's Pregnancy domain. */
export type ZLBFPublishPregnancyStateRequest = ZLBFSetPregnancyStateRequest;

/** Authoritative snapshot response to a Pregnancy progression publication. */
export type ZLBFPublishPregnancyStateResponse = ZLBFSyncStateResponse;

/** Request to allocate or recover the authenticated player's pending birth operation. */
export type ZLBFAllocateBirthRequest = ZLBFSyncStateRequest;

/** Authoritative snapshot containing the allocated pending birth identity. */
export type ZLBFAllocateBirthResponse = ZLBFSyncStateResponse;

/** Validator for bounded client-generated request identifiers. */
const requestId = string({ minimumLength: 1, maximumLength: 64 });
/** Validator for every status understood by this protocol version. */
const syncStatus = oneOf<ZLBFSyncStatus>([
	ZLBFSyncStatus.OK,
	ZLBFSyncStatus.INVALID_REQUEST,
	ZLBFSyncStatus.UNSUPPORTED_SCHEMA,
	ZLBFSyncStatus.UNSUPPORTED_DATA_SCHEMA,
	ZLBFSyncStatus.FORBIDDEN
]);
/** Runtime schema for authoritative snapshot metadata. */
const snapshotSchema = object<ZLBFSnapshot>({
	dataSchemaVersion: positiveInteger,
	stateVersion: nonNegativeInteger,
	domains: object<AuthoritativeDomains>({
		pregnancy: pregnancyStateSchema,
		birth: birthStateSchema
	})
});
/** Runtime schema for untrusted sync-state requests. */
const requestSchema = object<ZLBFSyncStateRequest>({
	schemaVersion: positiveInteger,
	requestId,
	revision: positiveInteger,
	data: emptyRecord
});
/** Runtime schema for untrusted sync-state responses. */
const responseSchema = object<ZLBFSyncStateResponse>({
	schemaVersion: positiveInteger,
	requestId,
	revision: positiveInteger,
	status: syncStatus,
	data: object<ZLBFSyncStateResponse["data"]>({ snapshot: snapshotSchema })
});
/** Runtime schema for untrusted Pregnancy debug mutation requests. */
const setPregnancyStateRequestSchema = object<ZLBFSetPregnancyStateRequest>({
	schemaVersion: positiveInteger,
	requestId,
	revision: positiveInteger,
	data: object<ZLBFSetPregnancyStateRequest["data"]>({ desired: pregnancyStateSchema })
});

/**
 * Validates an untrusted client-command payload before server code reads it.
 *
 * @param value Raw value received from Project Zomboid's client-command event.
 * @returns Whether the value is a structurally valid sync-state request.
 */
export const isZLBFSyncStateRequest = requestSchema;

/**
 * Validates an untrusted server-command payload before client code reads it.
 *
 * @param response Raw value received from Project Zomboid's server-command event.
 * @returns Whether the value is a structurally valid sync-state response.
 */
export const isZLBFSyncStateResponse = responseSchema;

/**
 * Validates an untrusted Pregnancy debug mutation payload.
 *
 * @param value Raw value received from Project Zomboid's client-command event.
 * @returns Whether the value is a structurally valid Pregnancy mutation request.
 */
export const isZLBFSetPregnancyStateRequest = setPregnancyStateRequestSchema;

/** Validates a Pregnancy mutation response, which uses the standard snapshot envelope. */
export const isZLBFSetPregnancyStateResponse = responseSchema;

/** Validates a normal Pregnancy progression publication payload. */
export const isZLBFPublishPregnancyStateRequest = setPregnancyStateRequestSchema;

/** Validates a Pregnancy progression response using the standard snapshot envelope. */
export const isZLBFPublishPregnancyStateResponse = responseSchema;

/** Validates a birth-allocation request, which carries no client-selected domain data. */
export const isZLBFAllocateBirthRequest = requestSchema;

/** Validates a birth-allocation response using the standard snapshot envelope. */
export const isZLBFAllocateBirthResponse = responseSchema;
