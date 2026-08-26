/* eslint-disable @typescript-eslint/no-explicit-any */
import { IsoPlayer } from "@asledgehammer/pipewrench";
import { mock } from "jest-mock-extended";

globalThis.print = jest.fn();
(globalThis as any).pcall = (fn: (...args: unknown[]) => unknown, ...args: unknown[]) => {
	try {
		const result = fn(...args);
		return [true, result];
	} catch (e) {
		return [false, String(e)];
	}
};

(globalThis as any).NewBFUI = () => ({
	setWidthPixel: jest.fn(),
	setHeight: jest.fn(),
	setVisible: jest.fn(),
	setTitle: jest.fn(),
	addText: jest.fn(),
	nextLine: jest.fn(),
	addProgressBar: jest.fn(),
	addButton: jest.fn(),
	addImage: jest.fn(),
	setBorderToAllElements: jest.fn(),
	saveLayout: jest.fn(),
	titleBarHeight: jest.fn(),
	yAct: 0,
	isUIVisible: false,
	setPositionPixel: jest.fn(),
	setPositionPercent: jest.fn(),
	toggle: jest.fn(),
	close: jest.fn(),
	open: jest.fn()
});

(globalThis as any).BFRecipes = {};
globalThis.sendAddItemToContainer = jest.fn();
globalThis.sendRemoveItemFromContainer = jest.fn();

(globalThis as any).CharacterStat = {
	HUNGER: "HUNGER",
	FATIGUE: "FATIGUE",
	FITNESS: "FITNESS",
	ENDURANCE: "ENDURANCE",
	THIRST: "THIRST",
	FOOD_SICKNESS: "FOOD_SICKNESS"
};

(globalThis as any).ResourceLocation = {
	of: jest.fn().mockImplementation((id: string) => id)
};

(globalThis as any).CharacterTrait = {
	get: jest.fn().mockImplementation((id: unknown) => ({
		getName: () => String(id),
		toString: () => String(id)
	}))
};

export const mockedPlayer = (overrides: Partial<IsoPlayer> = {}) =>
	mock<IsoPlayer>({
		HasTrait: jest.fn().mockReturnValue(false),
		getCharacterTraits: jest.fn().mockReturnValue({
			get: jest.fn().mockReturnValue(false),
			getKnownTraits: jest.fn().mockReturnValue({
				size: jest.fn().mockReturnValue(0),
				get: jest.fn()
			}),
			add: jest.fn(),
			remove: jest.fn()
		}),
		...overrides
	});
