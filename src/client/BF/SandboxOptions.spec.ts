import { LactationOptions, PregnancyOptions, WombOptions } from "@client/SandboxOptions";

describe("SandboxOptions", () => {
	afterEach(() => {
		delete (globalThis as { SandboxVars?: unknown }).SandboxVars;
	});

	it("falls back to defaults when SandboxVars.BF is unavailable", () => {
		expect(PregnancyOptions.duration).toBe(14 * 24 * 60);
		expect(PregnancyOptions.pregnancyRecovery).toBe(7);
		expect(WombOptions.wombCapacity).toBe(1);
		expect(WombOptions.wombRecovery).toBe(7);
		expect(LactationOptions.milkCapacity).toBe(1);
		expect(LactationOptions.milkExpiration).toBe(168);
	});

	it("reads nested values from SandboxVars.BF", () => {
		(globalThis as { SandboxVars?: { BF?: BFSandboxOptions } }).SandboxVars = {
			BF: {
				PregnancyDuration: 21,
				PregnancyRecovery: 10,
				WombMaxCapacity: 1.75,
				MilkCapacity: 2.4,
				MilkExpiration: 12
			}
		};

		expect(PregnancyOptions.duration).toBe(21 * 24 * 60);
		expect(PregnancyOptions.pregnancyRecovery).toBe(10);
		expect(WombOptions.wombCapacity).toBe(1.75);
		expect(WombOptions.wombRecovery).toBe(10);
		expect(LactationOptions.milkCapacity).toBe(2.4);
		expect(LactationOptions.milkExpiration).toBe(288);
	});
});
