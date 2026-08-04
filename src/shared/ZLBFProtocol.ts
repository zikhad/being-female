import { ZLBFSyncStatus } from "@constants";

type ZLBFEnvelopeMetadata = {
	schemaVersion: number;
	requestId: string;
	revision: number;
};

export type ZLBFSyncStateRequest = ZLBFEnvelopeMetadata & {
	data: Record<string, never>;
};

export type ZLBFSnapshot = {
	dataSchemaVersion: number;
	stateVersion: number;
};

export type ZLBFSyncStateResponse = ZLBFEnvelopeMetadata & {
	status: ZLBFSyncStatus;
	data: { snapshot: ZLBFSnapshot };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const isPositiveInteger = (value: unknown): value is number =>
	typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value > 0;

const isNonNegativeInteger = (value: unknown): value is number =>
	typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;

const isRequestId = (value: unknown): value is string =>
	typeof value === "string" && value.length > 0 && value.length <= 64;

const isZLBFSyncStatus = (value: unknown): value is ZLBFSyncStatus =>
	value === ZLBFSyncStatus.OK ||
	value === ZLBFSyncStatus.INVALID_REQUEST ||
	value === ZLBFSyncStatus.UNSUPPORTED_SCHEMA;

const isEnvelopeMetadata = (value: Record<string, unknown>): boolean =>
	isPositiveInteger(value.schemaVersion) &&
	isRequestId(value.requestId) &&
	isPositiveInteger(value.revision);

export const isZLBFSyncStateRequest = (value: unknown): value is ZLBFSyncStateRequest => {
	return (
		isRecord(value) &&
		isEnvelopeMetadata(value) &&
		isRecord(value.data) &&
		Object.keys(value.data).length === 0
	);
};

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
