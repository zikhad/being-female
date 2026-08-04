import { ZLBFSyncStatus } from "@constants";
import { isZLBFSyncStateRequest, isZLBFSyncStateResponse } from "@shared/ZLBFProtocol";

describe("ZLBFProtocol validators", () => {
	it("accepts valid request and response envelopes", () => {
		const request = { schemaVersion: 1, requestId: "snapshot-1", revision: 1, data: {} };
		expect(isZLBFSyncStateRequest(request)).toBe(true);
		expect(
			isZLBFSyncStateResponse({
				...request,
				status: ZLBFSyncStatus.OK,
				data: { snapshot: { dataSchemaVersion: 1, stateVersion: 0 } }
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
});
