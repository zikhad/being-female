import { BFSyncStatus } from "@constants";
import {
	isBFSetPregnancyStateRequest,
	isBFSyncStateRequest,
	isBFSyncStateResponse
} from "@shared/BFProtocol";
import { createDefaultPregnancyState } from "@shared/domain/pregnancy/PregnancyState";
import { createDefaultDomains } from "@shared/BFState";

const snapshot = (schemaVersion: number, stateVersion: number) => ({
	schemaVersion,
	stateVersion,
	domains: createDefaultDomains()
});

describe("BFProtocol validators", () => {
	it("accepts valid request and response envelopes", () => {
		const request = { schemaVersion: 1, requestId: "snapshot-1", revision: 1, data: {} };
		expect(isBFSyncStateRequest(request)).toBe(true);
		expect(
			isBFSyncStateResponse({
				...request,
				status: BFSyncStatus.OK,
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
		expect(isBFSyncStateRequest(value)).toBe(false);
	});

	it.each([
		{ schemaVersion: 1, requestId: "request", revision: 1, status: "UNKNOWN", data: {} },
		{
			schemaVersion: 1,
			requestId: "request",
			revision: 1,
			status: BFSyncStatus.OK,
			data: { snapshot: { schemaVersion: 1, stateVersion: Number.POSITIVE_INFINITY } }
		}
	])("rejects malformed response %#", value => {
		expect(isBFSyncStateResponse(value)).toBe(false);
	});

	it.each([
		BFSyncStatus.OK,
		BFSyncStatus.INVALID_REQUEST,
		BFSyncStatus.UNSUPPORTED_SCHEMA,
		BFSyncStatus.UNSUPPORTED_DATA_SCHEMA,
		BFSyncStatus.FORBIDDEN
	])("accepts supported response status %s", status => {
		expect(
			isBFSyncStateResponse({
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
			isBFSetPregnancyStateRequest({
				schemaVersion: 1,
				requestId: "pregnancy-1",
				revision: 1,
				data: { desired: createDefaultPregnancyState() }
			})
		).toBe(true);
		expect(
			isBFSetPregnancyStateRequest({
				schemaVersion: 1,
				requestId: "pregnancy-1",
				revision: 1,
				data: { desired: { status: "pregnant", progress: 2 } }
			})
		).toBe(false);
	});
});
