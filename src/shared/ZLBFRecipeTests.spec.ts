import { mock } from "jest-mock-extended";
import { isServer, type InventoryItem, type IsoGameCharacter } from "@asledgehammer/pipewrench";
import { ZLBFRecipeTests } from "@shared/ZLBFRecipeTests";
import { createDefaultDomains } from "@shared/ZLBFState";
import { ZLBF_STATE_MOD_DATA_KEY } from "@constants";
import { CharacterTraitApi } from "@shared/components/CharacterTraitApi";
import { PregnancyStatus } from "@shared/domain/pregnancy/PregnancyState";

jest.mock("@asledgehammer/pipewrench", () => ({ isServer: jest.fn(() => true) }));

/** Creates an actor and mutable ModData for shared eligibility tests. */
const actor = () => {
	const domains = createDefaultDomains();
	domains.lactation = { isActive: true, milkAmount: 0.4, expiration: 12, multiplier: 0 };
	domains.womb = { cycleDay: 1, amount: 0.2, total: 0.2, onContraceptive: false };
	const data: Record<string, unknown> = {
		ZLBFWomb: { cycleDay: 1, amount: 0.2, total: 0.2, onContraceptive: false },
		ZLBFLactation: domains.lactation,
		[ZLBF_STATE_MOD_DATA_KEY]: { domains }
	};
	const contains = jest.fn(() => true);
	const character = mock<IsoGameCharacter>({
		isFemale: jest.fn(() => true),
		getModData: jest.fn(() => data),
		getInventory: jest.fn(() => ({ contains }) as never)
	});
	return { character, contains, data, domains };
};

/** Creates a fluid item with configurable capacity, contents, and primary fluid. */
const fluidItem = (full = false, amount = 0.4, primary = "HumanMilk") =>
	mock<InventoryItem>({
		getFluidContainer: jest.fn(
			() =>
				({
					isFull: () => full,
					isEmpty: () => amount === 0,
					getAmount: () => amount,
					getPrimaryFluid: () => primary
				}) as never
		)
	});

beforeEach(() => jest.mocked(isServer).mockReturnValue(true));

describe("ZLBFRecipeTests", () => {
	it("accepts all eight recipes for an eligible supplied actor", () => {
		const { character } = actor();
		const item = fluidItem();
		for (const name of Object.keys(ZLBFRecipeTests)) {
			expect(ZLBFRecipeTests[name](item, character)).toBe(true);
		}
	});

	it("rejects every recipe for a non-female actor", () => {
		const { character } = actor();
		jest.mocked(character.isFemale).mockReturnValue(false);
		for (const name of Object.keys(ZLBFRecipeTests)) {
			expect(ZLBFRecipeTests[name](fluidItem(), character)).toBe(false);
		}
	});

	it("uses authoritative zero Lactation instead of nonzero legacy state", () => {
		const { character, data, domains } = actor();
		domains.lactation = { isActive: false, milkAmount: 0, expiration: 0, multiplier: 0 };
		data.ZLBFLactation = { isActive: true, milkAmount: 1, expiration: 12, multiplier: 1 };
		expect(ZLBFRecipeTests.HandExpress(fluidItem(), character)).toBe(false);
		expect(ZLBFRecipeTests.BreastPump(fluidItem(), character)).toBe(false);
		expect(ZLBFRecipeTests.BreastFeedBaby(fluidItem(), character)).toBe(false);
	});

	it("ignores a stale server-owned root during client eligibility checks", () => {
		jest.mocked(isServer).mockReturnValue(false);
		const { character, data, domains } = actor();
		domains.womb.amount = 0.2;
		(data.ZLBFWomb as { amount: number }).amount = 0;

		expect(ZLBFRecipeTests.PushCum(fluidItem(), character)).toBe(false);
		expect(ZLBFRecipeTests.ClearSperm(fluidItem(), character)).toBe(false);
	});

	it("enforces recovery, contraceptive, fluid capacity, baby, and milk-fluid gates", () => {
		const { character, contains, data, domains } = actor();
		const womb = data.ZLBFWomb as { cycleDay: number; onContraceptive: boolean };
		womb.cycleDay = -2;
		domains.womb.cycleDay = -2;
		expect(ZLBFRecipeTests.TakeContraceptive(fluidItem(), character)).toBe(false);
		womb.cycleDay = 1;
		domains.womb.cycleDay = 1;
		womb.onContraceptive = true;
		domains.womb.onContraceptive = true;
		expect(ZLBFRecipeTests.TakeContraceptive(fluidItem(), character)).toBe(false);
		expect(ZLBFRecipeTests.HandExpress(fluidItem(true), character)).toBe(false);
		domains.womb.amount = 0;
		expect(ZLBFRecipeTests.ClearSperm(fluidItem(), character)).toBe(false);
		expect(ZLBFRecipeTests.PushCum(fluidItem(), character)).toBe(false);
		contains.mockReturnValue(false);
		expect(ZLBFRecipeTests.BottleFeedBaby(fluidItem(), character)).toBe(false);
		contains.mockReturnValue(true);
		expect(ZLBFRecipeTests.BottleFeedBaby(fluidItem(false, 0.4, "Semen"), character)).toBe(
			false
		);
	});

	it("allows initialized nonpregnant data and rejects authoritative or legacy Pregnancy", () => {
		const { character, data, domains } = actor();
		data.ZLBFPregnancy = { current: 0, progress: 0, isInLabor: false };
		expect(ZLBFRecipeTests.TakeContraceptive(fluidItem(), character)).toBe(true);
		domains.pregnancy = {
			status: PregnancyStatus.PREGNANT,
			current: 1,
			progress: 0.1,
			isInLabor: false
		};
		expect(ZLBFRecipeTests.TakeContraceptive(fluidItem(), character)).toBe(false);
		delete data[ZLBF_STATE_MOD_DATA_KEY];
		jest.spyOn(CharacterTraitApi, "hasTrait").mockReturnValue(true);
		expect(ZLBFRecipeTests.TakeContraceptive(fluidItem(), character)).toBe(false);
	});
});
