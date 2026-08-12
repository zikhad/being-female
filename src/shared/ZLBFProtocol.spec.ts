import { ZLBFSyncStatus } from "@constants";
import {
	isZLBFSetPregnancyStateRequest,
	isZLBFSyncStateRequest,
	isZLBFSyncStateResponse
} from "@shared/ZLBFProtocol";
import { createDefaultPregnancyState } from "@shared/domain/pregnancy/PregnancyState";
import { createDefaultDomains } from "@shared/ZLBFState";

const snapshot = (dataSchemaVersion: number, stateVersion: number) => ({
	dataSchemaVersion,
	stateVersion,
	domains: createDefaultDomains()
});

describe("ZLBFProtocol validators", () => {
	it("accepts valid request and response envelopes", () => {
		const request = { schemaVersion: 1, requestId: "snapshot-1", revision: 1, data: {} };
		expect(isZLBFSyncStateRequest(request)).toBe(true);
		expect(
			isZLBFSyncStateResponse({
				...request,
				status: ZLBFSyncStatus.OK,
				data: { snapshot: snapshot(2, 0) }
			})
		).toBe(true);
	});

	it.each([
		undefined,
		null,
		{},
		{ schemaVersion: Number.NaN, requestId: "request", revision: 1, data: {} },
		{ schemaVersion: 1, requestId: "", revision: 1, data: {} },
		{ schemaVersion: 1, requestId: "request", revision: 1.5, data: {} }
	])("rejects malformed request %#", value => {
		expect(isZLBFSyncStateRequest(value)).toBe(false);
	});

	it.each([
		{ schemaVersion: 1, requestId: "request", revision: 1, status: "UNKNOWN", data: {} },
		{
			schemaVersion: 1,
			requestId: "request",
			revision: 1,
			status: ZLBFSyncStatus.OK,
			data: { snapshot: { dataSchemaVersion: 1, stateVersion: Number.POSITIVE_INFINITY } }
		}
	])("rejects malformed response %#", value => {
		expect(isZLBFSyncStateResponse(value)).toBe(false);
	});

	it.each([
		ZLBFSyncStatus.OK,
		ZLBFSyncStatus.INVALID_REQUEST,
		ZLBFSyncStatus.UNSUPPORTED_SCHEMA,
		ZLBFSyncStatus.UNSUPPORTED_DATA_SCHEMA,
		ZLBFSyncStatus.FORBIDDEN
	])("accepts supported response status %s", status => {
		expect(
			isZLBFSyncStateResponse({
				schemaVersion: 1,
				requestId: "request",
				revision: 1,
				status,
				data: { snapshot: snapshot(2, 0) }
			})
		).toBe(true);
	});

	it("validates Pregnancy mutation request payloads", () => {
		expect(
			isZLBFSetPregnancyStateRequest({
				schemaVersion: 1,
				requestId: "pregnancy-1",
				revision: 1,
				data: { desired: createDefaultPregnancyState() }
			})
		).toBe(true);
		expect(
			isZLBFSetPregnancyStateRequest({
				schemaVersion: 1,
				requestId: "pregnancy-1",
				revision: 1,
				data: { desired: { status: "pregnant", progress: 2 } }
			})
		).toBe(false);
	});
});
