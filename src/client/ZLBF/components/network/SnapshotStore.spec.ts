import { SnapshotStore } from "@client/components/network/SnapshotStore";
import { createDefaultPregnancyState } from "@shared/domain/pregnancy/PregnancyState";

describe("SnapshotStore", () => {
	it("updates the mirror before notifying subscribers", () => {
		const store = new SnapshotStore();
		const listener = jest.fn(snapshot => expect(store.snapshot).toBe(snapshot));
		const snapshot = {
			dataSchemaVersion: 2,
			stateVersion: 1,
			domains: { pregnancy: createDefaultPregnancyState() }
		};
		store.subscribe(listener);

		store.apply(snapshot);

		expect(listener).toHaveBeenCalledWith(snapshot);
	});
});
