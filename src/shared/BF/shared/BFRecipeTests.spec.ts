import { mock } from "jest-mock-extended";
import { isServer, type InventoryItem, type IsoGameCharacter } from "@asledgehammer/pipewrench";
import { BFRecipeTests } from "@shared/BFRecipeTests";
import { createDefaultDomains } from "@shared/BFState";
import { BF_STATE_MOD_DATA_KEY } from "@constants";
import { CharacterTraitApi } from "@shared/components/CharacterTraitApi";
import { PregnancyStatus } from "@shared/domain/pregnancy/PregnancyState";

jest.mock("@asledgehammer/pipewrench", () => ({ isServer: jest.fn(() => true) }));

/** Creates an actor and mutable ModData for shared eligibility tests. */
const actor = () => {
	const domains = createDefaultDomains();
	domains.lactation = { isActive: true, milkAmount: 0.4, expiration: 12, multiplier: 0 };
	domains.womb = { cycleDay: 1, amount: 0.2, total: 0.2, onContraceptive: false };
	const data: Record<string, unknown> = {
		BFWomb: { cycleDay: 1, amount: 0.2, total: 0.2, onContraceptive: false },
		BFLactation: domains.lactation,
		[BF_STATE_MOD_DATA_KEY]: { domains }
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

describe("BFRecipeTests", () => {
	it("accepts all eight recipes for an eligible supplied actor", () => {
		const { character } = actor();
		const item = fluidItem();
		for (const name of Object.keys(BFRecipeTests)) {
			expect(BFRecipeTests[name](item, character)).toBe(true);
		}
	});

	it("rejects every recipe for a non-female actor", () => {
		const { character } = actor();
		jest.mocked(character.isFemale).mockReturnValue(false);
		for (const name of Object.keys(BFRecipeTests)) {
			expect(BFRecipeTests[name](fluidItem(), character)).toBe(false);
		}
	});

	it("uses authoritative zero Lactation instead of nonzero legacy state", () => {
		const { character, data, domains } = actor();
		domains.lactation = { isActive: false, milkAmount: 0, expiration: 0, multiplier: 0 };
		data.BFLactation = { isActive: true, milkAmount: 1, expiration: 12, multiplier: 1 };
		expect(BFRecipeTests.HandExpress(fluidItem(), character)).toBe(false);
		expect(BFRecipeTests.BreastPump(fluidItem(), character)).toBe(false);
		expect(BFRecipeTests.BreastFeedBaby(fluidItem(), character)).toBe(false);
	});

	it("ignores a stale server-owned root during client eligibility checks", () => {
		jest.mocked(isServer).mockReturnValue(false);
		const { character, data, domains } = actor();
		domains.womb.amount = 0.2;
		(data.BFWomb as { amount: number }).amount = 0;

		expect(BFRecipeTests.PushCum(fluidItem(), character)).toBe(false);
		expect(BFRecipeTests.ClearSperm(fluidItem(), character)).toBe(false);
	});

	it("enforces recovery, contraceptive, fluid capacity, baby, and milk-fluid gates", () => {
		const { character, contains, data, domains } = actor();
		const womb = data.BFWomb as { cycleDay: number; onContraceptive: boolean };
		womb.cycleDay = -2;
		domains.womb.cycleDay = -2;
		expect(BFRecipeTests.TakeContraceptive(fluidItem(), character)).toBe(false);
		womb.cycleDay = 1;
		domains.womb.cycleDay = 1;
		womb.onContraceptive = true;
		domains.womb.onContraceptive = true;
		expect(BFRecipeTests.TakeContraceptive(fluidItem(), character)).toBe(false);
		expect(BFRecipeTests.HandExpress(fluidItem(true), character)).toBe(false);
		domains.womb.amount = 0;
		expect(BFRecipeTests.ClearSperm(fluidItem(), character)).toBe(false);
		expect(BFRecipeTests.PushCum(fluidItem(), character)).toBe(false);
		contains.mockReturnValue(false);
		expect(BFRecipeTests.BottleFeedBaby(fluidItem(), character)).toBe(false);
		contains.mockReturnValue(true);
		expect(BFRecipeTests.BottleFeedBaby(fluidItem(false, 0.4, "Semen"), character)).toBe(false);
	});

	it("allows initialized nonpregnant data and rejects authoritative or legacy Pregnancy", () => {
		const { character, data, domains } = actor();
		data.BFPregnancy = { current: 0, progress: 0, isInLabor: false };
		expect(BFRecipeTests.TakeContraceptive(fluidItem(), character)).toBe(true);
		domains.pregnancy = {
			status: PregnancyStatus.PREGNANT,
			current: 1,
			progress: 0.1,
			isInLabor: false
		};
		expect(BFRecipeTests.TakeContraceptive(fluidItem(), character)).toBe(false);
		delete data[BF_STATE_MOD_DATA_KEY];
		jest.spyOn(CharacterTraitApi, "hasTrait").mockReturnValue(true);
		expect(BFRecipeTests.TakeContraceptive(fluidItem(), character)).toBe(false);
	});
});
