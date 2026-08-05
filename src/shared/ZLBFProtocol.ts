import { ZLBFSyncStatus } from "@constants";
import {
	emptyRecord,
	nonNegativeInteger,
	object,
	oneOf,
	positiveInteger,
	string
} from "@shared/validation/Schema";

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
};

/** Targeted server response correlated to a {@link ZLBFSyncStateRequest}. */
export type ZLBFSyncStateResponse = ZLBFEnvelopeMetadata & {
	/** Outcome of validating and handling the request. */
	status: ZLBFSyncStatus;
	/** Read-only authoritative snapshot returned by the server. */
	data: { snapshot: ZLBFSnapshot };
};

/** Validator for bounded client-generated request identifiers. */
const requestId = string({ minimumLength: 1, maximumLength: 64 });
/** Validator for every status understood by this protocol version. */
const syncStatus = oneOf<ZLBFSyncStatus>([
	ZLBFSyncStatus.OK,
	ZLBFSyncStatus.INVALID_REQUEST,
	ZLBFSyncStatus.UNSUPPORTED_SCHEMA,
	ZLBFSyncStatus.UNSUPPORTED_DATA_SCHEMA
]);
/** Runtime schema for authoritative snapshot metadata. */
const snapshotSchema = object<ZLBFSnapshot>({
	dataSchemaVersion: positiveInteger,
	stateVersion: nonNegativeInteger
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
