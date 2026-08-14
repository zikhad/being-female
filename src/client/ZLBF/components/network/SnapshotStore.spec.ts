import { SnapshotStore } from "@client/components/network/SnapshotStore";
import { createDefaultPregnancyState } from "@shared/domain/pregnancy/PregnancyState";
import { createDefaultDomains } from "@shared/ZLBFState";

describe("SnapshotStore", () => {
	it("updates the mirror before notifying subscribers", () => {
		const store = new SnapshotStore();
		const listener = jest.fn(snapshot => expect(store.snapshot).toBe(snapshot));
		const snapshot = {
			dataSchemaVersion: 2,
			stateVersion: 1,
			domains: createDefaultDomains()
		};
		store.subscribe(listener);

		store.apply(snapshot);

		expect(listener).toHaveBeenCalledWith(snapshot);
	});

	it("ignores an older snapshot delivered after newer state", () => {
		const store = new SnapshotStore();
		const listener = jest.fn();
		const newer = { dataSchemaVersion: 4, stateVersion: 4, domains: createDefaultDomains() };
		const older = {
			dataSchemaVersion: 4,
			stateVersion: 3,
			domains: {
				...createDefaultDomains(),
				pregnancy: createDefaultPregnancyState()
			}
		};
		store.subscribe(listener);
		store.apply(newer);
		listener.mockClear();

		store.apply(older);

		expect(store.snapshot).toBe(newer);
		expect(listener).not.toHaveBeenCalled();
	});
});
