/* eslint-disable @typescript-eslint/no-explicit-any */
import { mock } from "jest-mock-extended";
import { IsoPlayer } from "@asledgehammer/pipewrench";
import { BFTraitsEnum } from "@constants";
import { PregnancyState } from "@client/components/PregnancyState";
import { CharacterTraitApi } from "@shared/components/CharacterTraitApi";

jest.mock("@shared/components/CharacterTraitApi");

describe("PregnancyState", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("persists updates through shared getModData storage", () => {
		(CharacterTraitApi.hasTrait as jest.Mock).mockReturnValue(true);

		const sharedStore: Record<string, unknown> = {};
		const player = mock<IsoPlayer>({
			getModData: jest.fn(() => sharedStore)
		});

		PregnancyState.initialize(player);
		PregnancyState.set(player, {
			current: 123,
			progress: 0.5,
			isInLabor: false
		});

		expect(PregnancyState.get(player)).toEqual({
			current: 123,
			progress: 0.5,
			isInLabor: false
		});
		expect(sharedStore["BFPregnancy"]).toEqual({
			current: 123,
			progress: 0.5,
			isInLabor: false
		});
	});

	it("returns null if getStore().data is undefined", () => {
		(CharacterTraitApi.hasTrait as jest.Mock).mockReturnValue(true);
		const player = mock<IsoPlayer>({
			getModData: jest.fn(() => ({ BFPregnancy: undefined }))
		});
		// Patch getStore to return { data: undefined }
		const origGetStore = (PregnancyState as any).getStore;
		(PregnancyState as any).getStore = () => ({ data: undefined });
		try {
			expect(PregnancyState.get(player)).toBeNull();
		} finally {
			(PregnancyState as any).getStore = origGetStore;
		}
	});

	it("returns null when player is missing pregnancy trait", () => {
		(CharacterTraitApi.hasTrait as jest.Mock).mockReturnValue(false);

		const player = mock<IsoPlayer>({
			getModData: jest.fn(() => ({}))
		});

		expect(PregnancyState.get(player)).toBeNull();
		expect(CharacterTraitApi.hasTrait).toHaveBeenCalledWith(player, BFTraitsEnum.PREGNANCY);
	});

	it("reads compatibility data without requiring the Pregnancy trait", () => {
		(CharacterTraitApi.hasTrait as jest.Mock).mockReturnValue(false);
		const player = mock<IsoPlayer>({
			getModData: jest.fn(() => ({
				BFPregnancy: { current: 12, progress: 0.25, isInLabor: false }
			}))
		});

		expect(PregnancyState.getStored(player)).toEqual({
			current: 12,
			progress: 0.25,
			isInLabor: false
		});
		expect(CharacterTraitApi.hasTrait).not.toHaveBeenCalled();
	});
});
