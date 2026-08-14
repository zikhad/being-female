
import { ZombRandFloat, InventoryItem } from "@asledgehammer/pipewrench";
import { lactation, womb } from "@client/ZLBF";
import { Fluids, ITEMS } from "@constants";
import { Recipe } from "server/types";
import { FluidContainerApi } from "@shared/components/FluidContainerApi";

declare let ZLBFRecipes: Recipe;

ZLBFRecipes = {
	OnTest: {
		TakeContraceptive: (_item, character) => {
			if (!character.isFemale()) return false;
			if (womb.contraceptive) return false;
			if (womb.pregnancy) return false;
			return true;
		},
		TakeLactaid: (_item, character) => {
			if (!character.isFemale()) return false;
			return true;
		},
		HandExpress: (item, character) => {
			if (!character.isFemale()) return false;
			if (new FluidContainerApi(item).isFull()) return false;
			return lactation.milkAmount >= lactation.bottleAmount * 2;
		},
		BreastPump: (item, character) => {
			if (!character.isFemale()) return false;
			if (new FluidContainerApi(item).isFull()) return false;
			return character.isFemale() && lactation.milkAmount >= lactation.bottleAmount;
		},
		ClearSperm: (_item, character) => {
			if (!character.isFemale()) return false;
			return womb.amount > 0;
		},
		PushCum: (item, character) => {
			if (!character.isFemale()) return false;
			if (womb.amount <= 0) return false;
			return !new FluidContainerApi(item).isFull();
		},
		BreastFeedBaby: (_item, character) => {
			if (!character.isFemale()) return false;
			return lactation.milkAmount >= lactation.bottleAmount;
		},
		BottleFeedBaby: (item, character) => {
			if (!character.isFemale()) return false;
			if (!character.getInventory().contains(ITEMS.BABY)) return false;
			
			const container = new FluidContainerApi(item);
			if (container.primaryFluid !== Fluids.HUMAN_MILK) return false;
			return container.amount >= lactation.bottleAmount;
		}
	},
	OnCreate: {
		TakeContraceptive: () => {
			womb.contraceptive = true;
		},
		TakeLactaid: () => {
			lactation.toggle(true);
			const multiplier = lactation.multiplier + ZombRandFloat(0, 0.3);
			lactation.useMilk(0, multiplier);
		},
		HandExpress: (items) => {
			const container = items.getInputItems(0).get(0) as InventoryItem;
			const amount = new FluidContainerApi(container).fill(Fluids.HUMAN_MILK, lactation.bottleAmount);
			lactation.useMilk(amount * 2, ZombRandFloat(0.05, 0.1)); // Waste half of the milk when hand expressing
		},
		BreastPump: (items) => {
			const container = items.getInputItems(1).get(0) as InventoryItem;
			const amount = new FluidContainerApi(container).fill(Fluids.HUMAN_MILK, lactation.bottleAmount);
			lactation.useMilk(amount, ZombRandFloat(0.1, 0.2));
		},
		ClearSperm: (items) => {
			const container = items.getInputItems(0).get(0) as InventoryItem;
			new FluidContainerApi(container).clear();
			womb.amount = 0;
		},
		PushCum: (items) => {
			const container = items.getInputItems(0).get(0) as InventoryItem; 
			const filledAmount = new FluidContainerApi(container).fill(Fluids.SEMEN, womb.amount);
			womb.amount -= Math.min(womb.amount, filledAmount);
		},
		BreastFeedBaby: () => {
			lactation.useMilk(lactation.bottleAmount, ZombRandFloat(0.2, 0.5));
		},
		BottleFeedBaby: (items) => {
			const container = items.getInputItems(0).get(0) as InventoryItem; 
			new FluidContainerApi(container).clear(lactation.bottleAmount);
		}
	}
};

export { ZLBFRecipes };
