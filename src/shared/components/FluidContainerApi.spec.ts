import { mock } from "jest-mock-extended";
import { InventoryItem } from "@asledgehammer/pipewrench";
import { FluidContainerApi } from "@shared/components/FluidContainerApi";
import { Fluid } from "@shared/components/FluidContainerApi";
import { Fluids } from "@constants";

const getMockedItem = ({
	capacity = 1,
	freeCapacity = 1.0,
	isFull = false,
	isEmpty = false,
	addFluid = jest.fn(),
	removeFluid = jest.fn(),
	isFluidContainer = true,
	primaryFluid = Fluids.HUMAN_MILK,
	amount = 1
}: Partial<{
	capacity: number;
	freeCapacity: number;
	isFull: boolean;
	isEmpty: boolean;
	addFluid: jest.Mock;
	removeFluid: jest.Mock;
	isFluidContainer: boolean;
	primaryFluid: Fluid;
	amount: number;
}> = {}) => {
	if (isFluidContainer) {
		return mock<InventoryItem>({
			getFluidContainer: jest.fn(() => ({
				removeFluid,
				addFluid,
				getFreeCapacity: jest.fn(() => freeCapacity),
				getCapacity: jest.fn(() => capacity),
				isFull: jest.fn(() => isFull),
				isEmpty: jest.fn(() => isEmpty),
				getPrimaryFluid: jest.fn(() => primaryFluid),
				getAmount: jest.fn(() => amount)
			}))
		});
	}
	return mock<InventoryItem>({
		getFluidContainer: jest.fn(() => null)
	});
};

describe("FluidContainerApi", () => {
	describe("amount", () => {
		it("should return amount when container exists", () => {
			const mockItem = getMockedItem({ amount: 0.42 });

			const api = new FluidContainerApi(mockItem);
			expect(api.amount).toBe(0.42);
		});

		it("should return 0 when container does not exist", () => {
			const mockItem = getMockedItem({ isFluidContainer: false });

			const api = new FluidContainerApi(mockItem);
			expect(api.amount).toBe(0);
		});
	});

	describe("primaryFluid", () => {
		it("should return primary fluid string when container exists", () => {
			const mockItem = getMockedItem({ primaryFluid: Fluids.HUMAN_MILK });

			const api = new FluidContainerApi(mockItem);
			expect(api.primaryFluid).toBe(Fluids.HUMAN_MILK);
		});

		it("should return null when container does not exist", () => {
			const mockItem = getMockedItem({ isFluidContainer: false });

			const api = new FluidContainerApi(mockItem);
			expect(api.primaryFluid).toBeNull();
		});
	});

	describe("hasContainer", () => {
		it("should return true when item exposes a fluid container", () => {
			const mockItem = getMockedItem();

			const api = new FluidContainerApi(mockItem);
			expect(api.hasContainer()).toBe(true);
		});

		it("should return false when item does not expose a fluid container", () => {
			const mockItem = getMockedItem({ isFluidContainer: false });

			const api = new FluidContainerApi(mockItem);
			expect(api.hasContainer()).toBe(false);
		});

		it("should return false when getFluidContainer is undefined", () => {
			const mockItem = mock<InventoryItem>();

			const api = new FluidContainerApi(mockItem);
			expect(api.hasContainer()).toBe(false);
		});
	});

	describe("isFull", () => {
		it("should return true when container exists and is full", () => {
			const mockItem = getMockedItem({ isFull: true });

			const api = new FluidContainerApi(mockItem);
			expect(api.isFull()).toBe(true);
		});

		it("should return false when container exists but is not full", () => {
			const mockItem = getMockedItem({ isFull: false });

			const api = new FluidContainerApi(mockItem);
			expect(api.isFull()).toBe(false);
		});

		it("should return false when container does not exist", () => {
			const mockItem = getMockedItem({ isFluidContainer: false });

			const api = new FluidContainerApi(mockItem);
			expect(api.isFull()).toBe(false);
		});
	});

	describe("isEmpty", () => {
		it("should return true when container exists and is empty", () => {
			const mockItem = getMockedItem({ isEmpty: true });

			const api = new FluidContainerApi(mockItem);
			expect(api.isEmpty()).toBe(true);
		});

		it("should return false when container exists but is not empty", () => {
			const mockItem = getMockedItem({ freeCapacity: 0.5, isEmpty: false });

			const api = new FluidContainerApi(mockItem);
			expect(api.isEmpty()).toBe(false);
		});

		it("should return false when container does not exist", () => {
			const mockItem = getMockedItem({ isFluidContainer: false });

			const api = new FluidContainerApi(mockItem);
			expect(api.isEmpty()).toBe(false);
		});
	});

	describe("fill", () => {
		it("should use container capacity when amount is not provided", () => {
			const addFluid = jest.fn();
			const mockItem = getMockedItem({ addFluid, freeCapacity: 1.0, capacity: 0.4 });

			const api = new FluidContainerApi(mockItem);
			const amount = api.fill("TestFluid");

			expect(amount).toBe(0.4);
			expect(addFluid).toHaveBeenCalledWith("TestFluid", 0.4);
		});

		it("should add fluid when container has free capacity", () => {
			const addFluid = jest.fn();
			const mockItem = getMockedItem({ addFluid, freeCapacity: 1.0, capacity: 0.5 });

			const api = new FluidContainerApi(mockItem);
			const amount = api.fill("TestFluid", 0.5);

			expect(amount).toBe(0.5);
			expect(addFluid).toHaveBeenCalledWith("TestFluid", 0.5);
		});

		it("should add only free capacity when requested amount exceeds capacity", () => {
			const addFluid = jest.fn();
			const mockItem = getMockedItem({ addFluid, freeCapacity: 0.3, capacity: 1.0 });

			const api = new FluidContainerApi(mockItem);
			const amount = api.fill("TestFluid", 0.8);

			expect(amount).toBe(0.3);
			expect(addFluid).toHaveBeenCalledWith("TestFluid", 0.3);
		});

		it("should return 0 when container is full", () => {
			const addFluid = jest.fn();

			const mockItem = getMockedItem({
				addFluid,
				freeCapacity: 0,
				capacity: 1.0,
				isFull: true,
				isEmpty: false
			});

			const api = new FluidContainerApi(mockItem);
			const amount = api.fill("TestFluid", 0.5);

			expect(amount).toBe(0);
			expect(addFluid).not.toHaveBeenCalled();
		});

		it("should return 0 when container does not exist", () => {
			const mockItem = getMockedItem({ isFluidContainer: false });

			const api = new FluidContainerApi(mockItem);
			const amount = api.fill("TestFluid", 0.5);

			expect(amount).toBe(0);
		});

		it("should return 0 when requested amount is zero", () => {
			const addFluid = jest.fn();
			const mockItem = getMockedItem({
				addFluid,
				freeCapacity: 1.0,
				capacity: 1.0,
				isFull: false,
				isEmpty: true
			});

			const api = new FluidContainerApi(mockItem);
			const amount = api.fill("TestFluid", 0);

			expect(amount).toBe(0);
			expect(addFluid).not.toHaveBeenCalled();
		});
	});

	describe("clear", () => {
		it("should remove only the requested amount when amount is provided", () => {
			const removeFluid = jest.fn();
			const mockItem = getMockedItem({ removeFluid });

			const api = new FluidContainerApi(mockItem);
			api.clear(0.25);

			expect(removeFluid).toHaveBeenCalledWith(0.25);
			expect(removeFluid).toHaveBeenCalledTimes(1);
		});

		it("should call removeFluid when container exists", () => {
			const removeFluid = jest.fn();
			const mockItem = getMockedItem({ removeFluid });

			const api = new FluidContainerApi(mockItem);
			api.clear();

			expect(removeFluid).toHaveBeenCalledTimes(1);
		});

		it("should not throw when container does not exist", () => {
			const mockItem = getMockedItem({ isFluidContainer: false });

			const api = new FluidContainerApi(mockItem);

			expect(() => api.clear()).not.toThrow();
		});
	});
});
