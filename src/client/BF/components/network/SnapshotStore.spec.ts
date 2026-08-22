import { SnapshotStore } from "@client/components/network/SnapshotStore";
import { createDefaultPregnancyState } from "@shared/domain/pregnancy/PregnancyState";
import { createDefaultDomains } from "@shared/BFState";

describe("SnapshotStore", () => {
	it("updates the mirror before notifying subscribers", () => {
		const store = new SnapshotStore();
		const listener = jest.fn(snapshot => expect(store.snapshot).toBe(snapshot));
		const snapshot = {
			schemaVersion: 1,
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
		const newer = { schemaVersion: 1, stateVersion: 4, domains: createDefaultDomains() };
		const older = {
			schemaVersion: 1,
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

	it("ignores a conflicting snapshot with the same server version", () => {
		const store = new SnapshotStore();
		const listener = jest.fn();
		const accepted = { schemaVersion: 1, stateVersion: 4, domains: createDefaultDomains() };
		const stale = {
			schemaVersion: 1,
			stateVersion: 4,
			domains: {
				...createDefaultDomains(),
				lactation: { isActive: true, milkAmount: 1, expiration: 10, multiplier: 1 }
			}
		};
		store.subscribe(listener);
		store.apply(accepted);
		listener.mockClear();

		store.apply(stale);

		expect(store.snapshot).toBe(accepted);
		expect(listener).not.toHaveBeenCalled();
	});

	it("treats a true equal-version duplicate as a no-op", () => {
		const store = new SnapshotStore();
		const listener = jest.fn();
		const snapshot = { schemaVersion: 1, stateVersion: 1, domains: createDefaultDomains() };
		store.subscribe(listener);
		store.apply(snapshot);
		listener.mockClear();

		store.apply(snapshot);

		expect(listener).not.toHaveBeenCalled();
	});

	it("explicitly re-notifies listeners of the retained current snapshot", () => {
		const store = new SnapshotStore();
		const listener = jest.fn();
		const snapshot = { schemaVersion: 1, stateVersion: 1, domains: createDefaultDomains() };
		store.apply(snapshot);
		store.subscribe(listener);
		store.notifyCurrent();
		expect(listener).toHaveBeenCalledWith(snapshot);
	});

	it("clears the connection snapshot while retaining subscribers", () => {
		const store = new SnapshotStore();
		const listener = jest.fn();
		store.subscribe(listener);
		store.apply({ schemaVersion: 1, stateVersion: 1, domains: createDefaultDomains() });

		store.resetSession();
		expect(store.snapshot).toBeUndefined();
		store.apply({ schemaVersion: 1, stateVersion: 1, domains: createDefaultDomains() });
		expect(listener).toHaveBeenCalledTimes(2);
	});
});
