import { ZLBFSyncStatus } from "@constants";

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

/** Returns whether an unknown runtime value is a non-null Lua table/object. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

/** Returns whether an unknown runtime value is a finite positive integer. */
const isPositiveInteger = (value: unknown): value is number =>
	typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value > 0;

/** Returns whether an unknown runtime value is a finite non-negative integer. */
const isNonNegativeInteger = (value: unknown): value is number =>
	typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;

/** Returns whether an unknown runtime value is a bounded non-empty request identifier. */
const isRequestId = (value: unknown): value is string =>
	typeof value === "string" && value.length > 0 && value.length <= 64;

/** Returns whether an unknown runtime value is a supported sync response status. */
const isZLBFSyncStatus = (value: unknown): value is ZLBFSyncStatus =>
	value === ZLBFSyncStatus.OK ||
	value === ZLBFSyncStatus.INVALID_REQUEST ||
	value === ZLBFSyncStatus.UNSUPPORTED_SCHEMA ||
	value === ZLBFSyncStatus.UNSUPPORTED_DATA_SCHEMA;

/** Validates the metadata fields common to request and response envelopes. */
const isEnvelopeMetadata = (value: Record<string, unknown>): boolean =>
	isPositiveInteger(value.schemaVersion) &&
	isRequestId(value.requestId) &&
	isPositiveInteger(value.revision);

/**
 * Validates an untrusted client-command payload before server code reads it.
 *
 * @param value Raw value received from Project Zomboid's client-command event.
 * @returns Whether the value is a structurally valid sync-state request.
 */
export const isZLBFSyncStateRequest = (value: unknown): value is ZLBFSyncStateRequest => {
	return (
		isRecord(value) &&
		isEnvelopeMetadata(value) &&
		isRecord(value.data) &&
		Object.keys(value.data).length === 0
	);
};

/**
 * Validates an untrusted server-command payload before client code reads it.
 *
 * @param response Raw value received from Project Zomboid's server-command event.
 * @returns Whether the value is a structurally valid sync-state response.
 */
export const isZLBFSyncStateResponse = (response: unknown): response is ZLBFSyncStateResponse => {
	if (!isRecord(response)) return false;
	if (!isEnvelopeMetadata(response) || !isRecord(response.data)) return false;

	const { data } = response;

	if (!isRecord(data.snapshot)) return false;
	if (!isZLBFSyncStatus(response.status)) return false;
	return (
		isPositiveInteger(data.snapshot.dataSchemaVersion) &&
		isNonNegativeInteger(data.snapshot.stateVersion)
	);
};
