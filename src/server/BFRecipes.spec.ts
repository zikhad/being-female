import { mock } from "jest-mock-extended";
import type { CraftRecipeData } from "@server/types";
import { isServer } from "@asledgehammer/pipewrench";
import type { InventoryItem, IsoPlayer } from "@asledgehammer/pipewrench";
import { BFRecipes } from "@server/BFRecipes";
import { BF_STATE_MOD_DATA_KEY, BF_STATE_SCHEMA_VERSION } from "@constants";
import { createDefaultDomains } from "@shared/BFState";
import { StateRepository } from "@server/components/state/StateRepository";

jest.mock("@asledgehammer/pipewrench", () => ({
	ZombRandFloat: jest.fn(() => 0.05),
	getRandomUUID: jest.fn(() => "recipe-character-id"),
	isServer: jest.fn(() => false),
	sendServerCommand: jest.fn()
}));

/** Creates one actor with isolated component-local and authoritative ModData. */
const actor = (milkAmount = 0.4, wombAmount = 0.2, cycleDay = 1, dairyCow = false) => {
	const domains = createDefaultDomains();
	domains.lactation = { isActive: true, milkAmount, expiration: 12, multiplier: 0.2 };
	domains.womb = {
		cycleDay,
		amount: wombAmount,
		total: wombAmount,
		onContraceptive: false
	};
	const modData: Record<string, unknown> = {
		BFWomb: { amount: wombAmount, total: wombAmount, cycleDay, onContraceptive: false },
		BFLactation: domains.lactation,
		[BF_STATE_MOD_DATA_KEY]: {
			schemaVersion: BF_STATE_SCHEMA_VERSION,
			characterId: "recipe-character-id",
			stateVersion: 2,
			domains
		}
	};
	const player = mock<IsoPlayer>({
		isFemale: jest.fn(() => true),
		getCharacterTraits: jest.fn(
			() =>
				({
					get: jest.fn(() => dairyCow),
					getKnownTraits: jest.fn(() => ({ size: jest.fn(() => 0), get: jest.fn() }))
				}) as never
		),
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

describe("BFRecipes actor authority", () => {
	beforeEach(() => {
		jest.mocked(isServer).mockReturnValue(false);
	});
	it("evaluates HandExpress from the supplied actor without getPlayer", () => {
		const first = actor(0.4);
		const second = actor(0.1);
		const { item } = recipeInput();
		expect(BFRecipes.OnTest.HandExpress(item, first.player)).toBe(true);
		expect(BFRecipes.OnTest.HandExpress(item, second.player)).toBe(false);
	});

	it("rejects contraceptive use during recovery", () => {
		const recovering = actor(0.4, 0, -3);
		expect(BFRecipes.OnTest.TakeContraceptive(mock<InventoryItem>(), recovering.player)).toBe(
			false
		);
	});

	it("persists HandExpress milk use while preserving all Lactation fields", () => {
		const load = jest.spyOn(StateRepository.prototype, "load");
		const { player, modData } = actor(0.4);
		const { items, addFluid } = recipeInput();
		BFRecipes.OnCreate.HandExpress(items, player);
		const root = modData[BF_STATE_MOD_DATA_KEY] as {
			stateVersion: number;
			domains: ReturnType<typeof createDefaultDomains>;
		};
		expect(addFluid).toHaveBeenCalledWith("HumanMilk", 0.2);
		expect(root.stateVersion).toBe(3);
		expect(root.domains.lactation).toEqual({
			isActive: true,
			milkAmount: 0,
			expiration: 168,
			multiplier: 0.5
		});
		expect(load).toHaveBeenCalledTimes(1);
		load.mockRestore();
	});

	it("keeps authoritative zero Lactation instead of reviving component-local milk", () => {
		jest.mocked(isServer).mockReturnValue(true);
		const { player, modData, domains } = actor(0);
		domains.lactation = { isActive: false, milkAmount: 0, expiration: 0, multiplier: 0 };
		modData.BFLactation = { isActive: true, milkAmount: 1, expiration: 12, multiplier: 1 };
		const { items } = recipeInput();
		BFRecipes.OnCreate.HandExpress(items, player);
		const root = modData[BF_STATE_MOD_DATA_KEY] as {
			domains: ReturnType<typeof createDefaultDomains>;
		};
		expect(root.domains.lactation.milkAmount).toBe(0);
	});

	it("adds deterministic Lactaid stimulation and refreshes duration", () => {
		const { player, modData } = actor();
		BFRecipes.OnCreate.TakeLactaid({} as CraftRecipeData, player);
		const root = modData[BF_STATE_MOD_DATA_KEY] as {
			domains: ReturnType<typeof createDefaultDomains>;
		};
		expect(root.domains.lactation).toEqual({
			isActive: true,
			milkAmount: 0.4,
			expiration: 168,
			multiplier: 0.45
		});
	});

	it("applies the Dairy Cow duration factor exactly once", () => {
		const { player, modData } = actor(0.4, 0.2, 1, true);
		BFRecipes.OnCreate.TakeLactaid({} as CraftRecipeData, player);
		const root = modData[BF_STATE_MOD_DATA_KEY] as {
			domains: ReturnType<typeof createDefaultDomains>;
		};
		expect(root.domains.lactation.expiration).toBe(210);
	});

	it("persists ClearSperm amount zero and clears its input container", () => {
		const { player, modData } = actor();
		const { items, removeFluid } = recipeInput();
		BFRecipes.OnCreate.ClearSperm(items, player);
		const root = modData[BF_STATE_MOD_DATA_KEY] as {
			domains: ReturnType<typeof createDefaultDomains>;
		};
		expect(removeFluid).toHaveBeenCalledWith();
		expect(root.domains.womb).toEqual({
			cycleDay: 1,
			amount: 0,
			total: 0.2,
			onContraceptive: false
		});
	});

	it("persists contraceptive state for authoritative client convergence", () => {
		const { player, modData } = actor();
		BFRecipes.OnCreate.TakeContraceptive({} as CraftRecipeData, player);
		const root = modData[BF_STATE_MOD_DATA_KEY] as {
			domains: ReturnType<typeof createDefaultDomains>;
		};
		expect(root.domains.womb.onContraceptive).toBe(true);
		expect((modData.BFWomb as { onContraceptive: boolean }).onContraceptive).toBe(true);
	});

	it("persists PushCum remaining amount", () => {
		const { player, modData } = actor(0.4, 0.2);
		const { items, addFluid } = recipeInput();
		BFRecipes.OnCreate.PushCum(items, player);
		const root = modData[BF_STATE_MOD_DATA_KEY] as {
			domains: ReturnType<typeof createDefaultDomains>;
		};
		expect(addFluid).toHaveBeenCalledWith("Semen", 0.2);
		expect(root.domains.womb.amount).toBe(0);
		expect((modData.BFWomb as { amount: number }).amount).toBe(0);
	});

	it.each(["HandExpress", "BreastPump", "ClearSperm", "PushCum", "BottleFeedBaby"])(
		"syncs the mutated item on the server for %s",
		name => {
			jest.mocked(isServer).mockReturnValue(true);
			const { player } = actor();
			const { items, item } = recipeInput();
			BFRecipes.OnCreate[name](items, player);
			expect(item.syncItemFields).toHaveBeenCalled();
		}
	);

	it("does not mutate item or component-local state when persisted schema is unsupported", () => {
		const { player, modData } = actor();
		modData[BF_STATE_MOD_DATA_KEY] = { schemaVersion: 99, stateVersion: 1 };
		const wombBefore = { ...(modData.BFWomb as Record<string, unknown>) };
		const lactationBefore = { ...(modData.BFLactation as Record<string, unknown>) };
		const { items, addFluid, removeFluid } = recipeInput();

		BFRecipes.OnCreate.HandExpress(items, player);
		BFRecipes.OnCreate.ClearSperm(items, player);

		expect(addFluid).not.toHaveBeenCalled();
		expect(removeFluid).not.toHaveBeenCalled();
		expect(modData.BFWomb).toEqual(wombBefore);
		expect(modData.BFLactation).toEqual(lactationBefore);
	});
});
