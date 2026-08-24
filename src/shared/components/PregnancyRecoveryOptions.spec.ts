import { PregnancyRecoveryOptions } from "@shared/components/PregnancyRecoveryOptions";

describe("PregnancyRecoveryOptions", () => {
	afterEach(() => delete (globalThis as { SandboxVars?: unknown }).SandboxVars);

	it("reads the current nested server-compatible sandbox value", () => {
		(globalThis as { SandboxVars?: { BF?: BFSandboxOptions } }).SandboxVars = {
			BF: { PregnancyRecovery: 11 }
		};
		expect(new PregnancyRecoveryOptions().read()).toEqual({
			days: 11,
			usedFallback: false
		});
	});

	it.each([undefined, -1, 57, 1.5, Number.NaN])(
		"falls back for invalid runtime value %#",
		value => {
			(globalThis as { SandboxVars?: { BF?: BFSandboxOptions } }).SandboxVars = {
				BF: { PregnancyRecovery: value }
			};
			expect(new PregnancyRecoveryOptions().read()).toEqual({
				days: 7,
				usedFallback: true
			});
		}
	);
});
