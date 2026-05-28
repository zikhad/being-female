import { InventoryItem } from "@asledgehammer/pipewrench";
import { Fluid } from "server/types";

/**
 * Wrapper for inventory items that may expose a fluid container.
 *
 * This helper centralizes the optional fluid-container API and
 * prevents duplicate `getFluidContainer` guard logic across code.
 */
export class FluidContainerApi {
	/**
	 * Creates a new FluidContainerApi for the given inventory item.
	 * @param item The inventory item to wrap. Should be checked for a fluid container before use.
	 */
	constructor(private readonly item: InventoryItem) {}

	/**
	 * Internal getter for the wrapped inventory item's fluid container, if it exists.
	 * Returns null if the item does not expose a fluid container.
	 * @private
	 */
	private get container() {
		return this.item.getFluidContainer?.() ?? null;
	}

	public get amount() {
		/**
		 * Current amount of fluid in the wrapped container (in milliliters).
		 * Returns 0 when no container is present.
		 */
		return this.container?.getAmount() ?? 0
	}

	/**
	 * The primary fluid type stored in the container, or null when empty or unavailable.
	 */
	public get primaryFluid(): Fluid | null {
		return this.container?.getPrimaryFluid().toString() ?? null;
	}

	/**
	 * Returns true when the wrapped inventory item exposes a fluid container.
	 * @returns True if the item has a fluid container, false otherwise.
	 */
	public hasContainer(): boolean {
		return this.container !== null;
	}

	/**
	 * Returns true when the wrapped fluid container exists and is full.
	 * @returns True if the container is full, false otherwise.
	 */
	public isFull(): boolean {
		return this.container?.isFull() ?? false;
	}

	/**
	 * Returns true when the wrapped fluid container exists and is empty.
	 * @returns True if the container is empty, false otherwise.
	 */
	public isEmpty(): boolean {
		return this.container?.isEmpty() ?? false;
	}
	

	/**
	 * Adds fluid to the wrapped container up to the requested amount.
	 *
	 * @param fluid The fluid type to add.
	 * @param amount The maximum amount to add. If not specified, will attempt to fill the container completely.
	 * @returns The amount actually added to the container.
	 */
	public fill(fluid: Fluid, amount?: number): number {
		const container = this.container;
		if (!container) return 0;
		const addedFluid = Math.min(container.getFreeCapacity(), amount ?? container.getCapacity());
		if (addedFluid <= 0) return 0;

		container.addFluid(fluid, addedFluid);
		return addedFluid;
	}

	/**
	 * Clears any fluid from the wrapped container.
	 */
	public clear(amount?: number): void {
		if (typeof amount == "number") this.container?.removeFluid(amount);
		this.container?.removeFluid();
	}
}
