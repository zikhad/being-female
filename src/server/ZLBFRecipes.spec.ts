import { mock } from "jest-mock-extended";
import type { CraftRecipeData } from "@server/types";
import { isServer } from "@asledgehammer/pipewrench";
import type { InventoryItem, IsoPlayer } from "@asledgehammer/pipewrench";
import { ZLBFRecipes } from "@server/ZLBFRecipes";
import { ZLBF_STATE_MOD_DATA_KEY } from "@constants";
import { createDefaultDomains } from "@shared/ZLBFState";

jest.mock("@asledgehammer/pipewrench", () => ({
	ZombRandFloat: jest.fn(() => 0.05),
	isServer: jest.fn(() => false),
	sendServerCommand: jest.fn()
}));

/** Creates one actor with isolated legacy and authoritative ModData. */
const actor = (milkAmount = 0.4, wombAmount = 0.2, cycleDay = 1) => {
	const domains = createDefaultDomains();
	domains.lactation = { isActive: true, milkAmount, expiration: 12, multiplier: 0.2 };
	domains.womb = { cycleDay, amount: wombAmount, total: wombAmount };
	const modData: Record<string, unknown> = {
		ZLBFWomb: { amount: wombAmount, total: wombAmount, cycleDay, onContraceptive: false },
		ZLBFLactation: domains.lactation,
		[ZLBF_STATE_MOD_DATA_KEY]: { dataSchemaVersion: 5, stateVersion: 2, domains }
	};
	const player = mock<IsoPlayer>({
		isFemale: jest.fn(() => true),
		getModData: jest.fn(() => modData)
	});
	return { player, modData, domains };
};

/** Creates a recipe input item backed by a mutable fluid-container mock. */
const recipeInput = () => {
	const addFluid = jest.fn();
	const removeFluid = jest.fn();
	const item = mock<InventoryItem>({
		getFluidContainer: jest.fn(
			() =>
				({
					isFull: jest.fn(() => false),
					isEmpty: jest.fn(() => true),
					getAmount: jest.fn(() => 0),
					getPrimaryFluid: jest.fn(() => "HumanMilk"),
					getFreeCapacity: jest.fn(() => 1),
					getCapacity: jest.fn(() => 1),
					addFluid,
					removeFluid
				}) as never
		)
	});
	const items = { getInputItems: () => ({ get: () => item }) } as unknown as CraftRecipeData;
	return { item, items, addFluid, removeFluid };
};

describe("ZLBFRecipes actor authority", () => {
	beforeEach(() => {
		jest.mocked(isServer).mockReturnValue(false);
	});
	it("evaluates HandExpress from the supplied actor without getPlayer", () => {
		const first = actor(0.4);
		const second = actor(0.1);
		const { item } = recipeInput();
		expect(ZLBFRecipes.OnTest.HandExpress(item, first.player)).toBe(true);
		expect(ZLBFRecipes.OnTest.HandExpress(item, second.player)).toBe(false);
	});

	it("rejects contraceptive use during recovery", () => {
		const recovering = actor(0.4, 0, -3);
		expect(ZLBFRecipes.OnTest.TakeContraceptive(mock<InventoryItem>(), recovering.player)).toBe(
			false
		);
	});

	it("persists HandExpress milk use while preserving all Lactation fields", () => {
		const { player, modData } = actor(0.4);
		const { items, addFluid } = recipeInput();
		ZLBFRecipes.OnCreate.HandExpress(items, player);
		const root = modData[ZLBF_STATE_MOD_DATA_KEY] as {
			stateVersion: number;
			domains: ReturnType<typeof createDefaultDomains>;
		};
		expect(addFluid).toHaveBeenCalledWith("HumanMilk", 0.2);
		expect(root.stateVersion).toBe(3);
		expect(root.domains.lactation).toEqual({
			isActive: true,
			milkAmount: 0,
			expiration: 12,
			multiplier: 0.05
		});
	});

	it("keeps an authoritative zero Lactation state instead of reviving nonzero legacy milk", () => {
		jest.mocked(isServer).mockReturnValue(true);
		const { player, modData, domains } = actor(0);
		domains.lactation = { isActive: false, milkAmount: 0, expiration: 0, multiplier: 0 };
		modData.ZLBFLactation = { isActive: true, milkAmount: 1, expiration: 12, multiplier: 1 };
		const { items } = recipeInput();
		ZLBFRecipes.OnCreate.HandExpress(items, player);
		const root = modData[ZLBF_STATE_MOD_DATA_KEY] as {
			domains: ReturnType<typeof createDefaultDomains>;
		};
		expect(root.domains.lactation.milkAmount).toBe(0);
	});

	it("persists ClearSperm amount zero and clears its input container", () => {
		const { player, modData } = actor();
		const { items, removeFluid } = recipeInput();
		ZLBFRecipes.OnCreate.ClearSperm(items, player);
		const root = modData[ZLBF_STATE_MOD_DATA_KEY] as {
			domains: ReturnType<typeof createDefaultDomains>;
		};
		expect(removeFluid).toHaveBeenCalledWith();
		expect(root.domains.womb).toEqual({ cycleDay: 1, amount: 0, total: 0.2 });
	});

	it("persists contraceptive state for authoritative client convergence", () => {
		const { player, modData } = actor();
		ZLBFRecipes.OnCreate.TakeContraceptive({} as CraftRecipeData, player);
		const root = modData[ZLBF_STATE_MOD_DATA_KEY] as {
			domains: ReturnType<typeof createDefaultDomains>;
		};
		expect(root.domains.womb.onContraceptive).toBe(true);
		expect((modData.ZLBFWomb as { onContraceptive: boolean }).onContraceptive).toBe(true);
	});

	it("persists PushCum remaining amount", () => {
		const { player, modData } = actor(0.4, 0.2);
		const { items, addFluid } = recipeInput();
		ZLBFRecipes.OnCreate.PushCum(items, player);
		const root = modData[ZLBF_STATE_MOD_DATA_KEY] as {
			domains: ReturnType<typeof createDefaultDomains>;
		};
		expect(addFluid).toHaveBeenCalledWith("Semen", 0.2);
		expect(root.domains.womb.amount).toBe(0);
		expect((modData.ZLBFWomb as { amount: number }).amount).toBe(0);
	});

	it.each(["HandExpress", "BreastPump", "ClearSperm", "PushCum", "BottleFeedBaby"])(
		"syncs the mutated item on the server for %s",
		name => {
			jest.mocked(isServer).mockReturnValue(true);
			const { player } = actor();
			const { items, item } = recipeInput();
			ZLBFRecipes.OnCreate[name](items, player);
			expect(item.syncItemFields).toHaveBeenCalled();
		}
	);

	it("does not mutate item or legacy state when persisted schema is unsupported", () => {
		const { player, modData } = actor();
		modData[ZLBF_STATE_MOD_DATA_KEY] = { dataSchemaVersion: 99, stateVersion: 1 };
		const wombBefore = { ...(modData.ZLBFWomb as Record<string, unknown>) };
		const lactationBefore = { ...(modData.ZLBFLactation as Record<string, unknown>) };
		const { items, addFluid, removeFluid } = recipeInput();

		ZLBFRecipes.OnCreate.HandExpress(items, player);
		ZLBFRecipes.OnCreate.ClearSperm(items, player);

		expect(addFluid).not.toHaveBeenCalled();
		expect(removeFluid).not.toHaveBeenCalled();
		expect(modData.ZLBFWomb).toEqual(wombBefore);
		expect(modData.ZLBFLactation).toEqual(lactationBefore);
	});
});
