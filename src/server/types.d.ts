import {
	ArrayList,
	InventoryItem,
	IsoGameCharacter,
	ItemContainer
} from "@asledgehammer/pipewrench";

declare global {
	/** Build 42 server global missing from the current PipeWrench declarations. */
	function sendAddItemToContainer(container: ItemContainer, item: InventoryItem): void;
}

export type Fluid = "HumanMilk" | "Semen" | string;

export type FluidContainer = {
	removeFluid(): void;
	addFluid(type: any, amount: number): void;
	getCapacity(): number;
};

export type FluidContainerItem = {
	getFluidContainer(): FluidContainer;
};

export type CraftRecipeData = {
	getInputItems(index: number): ArrayList;
};

export type Recipe = {
	OnTest: Record<string, (item: InventoryItem, character: IsoGameCharacter) => boolean>;
	OnCreate: Record<string, (items: CraftRecipeData, character: IsoGameCharacter) => void>;
};
