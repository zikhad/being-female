/* eslint-disable @typescript-eslint/no-explicit-any */
import { mock } from "jest-mock-extended";
import * as Events from "@asledgehammer/pipewrench-events";
import { Player } from "@client/components/Player";
import {
	IsoPlayer,
	BodyPartType,
	BodyPart,
	BodyDamage,
	ItemContainer,
	HaloTextHelper
} from "@asledgehammer/pipewrench";
import { BFTraitsEnum } from "@constants";
import { CharacterTraitApi } from "@shared/components/CharacterTraitApi";

// Mocks
jest.mock("@asledgehammer/pipewrench");
jest.mock("@asledgehammer/pipewrench-events");
jest.mock("@client/components/ModData", () => ({
	ModData: jest.fn().mockImplementation(({ defaultData }) => {
		let storedData: any = null;
		let accessed = false;
		return {
			get data() {
				if (!accessed) {
					accessed = true;
					return storedData; // Return null on first access
				}
				return storedData !== null ? storedData : defaultData;
			},
			set data(value: any) {
				storedData = value;
			}
		};
	})
}));
jest.mock("@shared/components/CharacterTraitApi", () => ({
	CharacterTraitApi: {
		hasTrait: jest.fn(),
		addTrait: jest.fn(),
		removeTrait: jest.fn()
	}
}));

class ConcretePlayer extends Player<Record<string, unknown>> {
	constructor(key?: string, defaultData?: Record<string, unknown>) {
		super(key);
		this.defaultData = defaultData;
	}
	public triggerOnCreatePlayer(player: IsoPlayer) {
		this.onCreatePlayer(player);
	}
	// Expose protected methods for testing
	public testHasTrait(trait: BFTraitsEnum): boolean {
		return this.hasTrait(trait);
	}
	public testAddTrait(trait: BFTraitsEnum): void {
		this.addTrait(trait);
	}
	public testRemoveTrait(trait: BFTraitsEnum): void {
		this.removeTrait(trait);
	}
}

describe("Player class", () => {
	const mockPlayer = mock<IsoPlayer>();
	const mockBodyDamage = mock<BodyDamage>();
	const mockBodyPart = mock<BodyPart>();

	beforeEach(() => {
		jest.clearAllMocks();

		mockPlayer.getCharacterTraits = jest.fn(() => ({
			get: jest.fn(() => true)
		})) as any;
		(mockPlayer.getBodyDamage as jest.Mock).mockReturnValue(mockBodyDamage);
		(mockBodyDamage.getBodyPart as jest.Mock).mockReturnValue(mockBodyPart);
	});

	it("initializes and creates mod data", () => {
		const instance = new ConcretePlayer("TEST_KEY");
		instance.triggerOnCreatePlayer(mockPlayer);

		expect(instance.player).toBe(mockPlayer);
		expect(instance.data).toBeDefined();
	});

	describe("Timer Events", () => {
		const addListener = jest.fn();
		beforeEach(() => {
			(Events as any).onCreatePlayer = { addListener };
		});
		it("should register onCreatePlayer event", () => {
			new ConcretePlayer();
			const [callback] = addListener.mock.calls[0];
			callback(mockPlayer);

			expect(addListener).toHaveBeenCalledWith(expect.any(Function));
		});
	});

	describe("hasItem", () => {
		it.each([{ hasItem: false }, { hasItem: true }])(
			"should return $hasItem if if inventory.contains is $hasItem",
			({ hasItem }) => {
				mockPlayer.getInventory.mockReturnValue(
					mock<ItemContainer>({
						contains: () => hasItem
					})
				);
				const instance = new ConcretePlayer("TEST_KEY");
				instance.triggerOnCreatePlayer(mockPlayer);

				const result = instance.hasItem("MockedItem");
				expect(result).toBe(hasItem);
			}
		);
		it("should return false if player is not defined", () => {
			const instance = new ConcretePlayer("TEST_KEY");
			const result = instance.hasItem("MockedItem");
			expect(result).toBe(false);
		});
	});

	describe("haloText", () => {
		it.each<{
			spyOn: () => jest.SpyInstance;
			style?: "good" | "bad";
		}>([
			{ style: "good", spyOn: () => jest.spyOn(HaloTextHelper, "addGoodText") },
			{ style: "bad", spyOn: () => jest.spyOn(HaloTextHelper, "addBadText") },
			{ spyOn: () => jest.spyOn(HaloTextHelper, "addText") }
		])("haloText should call HaloTextHelper with style $style", ({ style, spyOn }) => {
			const spy = spyOn();
			const instance = new ConcretePlayer();
			instance.triggerOnCreatePlayer(mockPlayer);
			instance.haloText({
				text: "mock",
				style
			});
			expect(spy).toHaveBeenCalled();
		});
		it("should do nothing if player is not defined", () => {
			const spy = jest.spyOn(HaloTextHelper, "addText");
			const instance = new ConcretePlayer();
			instance.haloText({
				text: "mock"
			});
			expect(spy).not.toHaveBeenCalled();
		});
	});

	describe("skinColorIndex", () => {
		it("should get player skin color", () => {
			const player = mock<IsoPlayer>({
				getHumanVisual: jest.fn().mockImplementation(() => ({
					getSkinTextureIndex: jest.fn().mockReturnValue(2)
				}))
			});

			const instance = new ConcretePlayer();
			instance.triggerOnCreatePlayer(player);
			expect(instance.skinColorIndex).toBe(2);
		});
		it("should return 0 by default", () => {
			const instance = new ConcretePlayer();
			expect(instance.skinColorIndex).toBe(0);
		});
	});

	describe("trait methods", () => {
		describe("hasTrait", () => {
			it("should return false when player is not set", () => {
				const instance = new ConcretePlayer();
				const result = instance.testHasTrait(BFTraitsEnum.FERTILE);
				expect(result).toBe(false);
				expect(CharacterTraitApi.hasTrait).not.toHaveBeenCalled();
			});

			it("should delegate to CharacterTraitApi when player is set", () => {
				const instance = new ConcretePlayer();
				instance.triggerOnCreatePlayer(mockPlayer);
				(CharacterTraitApi.hasTrait as jest.Mock).mockReturnValue(true);

				const result = instance.testHasTrait(BFTraitsEnum.FERTILE);

				expect(result).toBe(true);
				expect(CharacterTraitApi.hasTrait).toHaveBeenCalledWith(
					mockPlayer,
					BFTraitsEnum.FERTILE
				);
			});
		});

		describe("addTrait", () => {
			it("should do nothing when player is not set", () => {
				const instance = new ConcretePlayer();
				instance.testAddTrait(BFTraitsEnum.FERTILE);
				expect(CharacterTraitApi.addTrait).not.toHaveBeenCalled();
			});

			it("should delegate to CharacterTraitApi when player is set", () => {
				const instance = new ConcretePlayer();
				instance.triggerOnCreatePlayer(mockPlayer);

				instance.testAddTrait(BFTraitsEnum.FERTILE);

				expect(CharacterTraitApi.addTrait).toHaveBeenCalledWith(
					mockPlayer,
					BFTraitsEnum.FERTILE
				);
			});
		});

		describe("removeTrait", () => {
			it("should do nothing when player is not set", () => {
				const instance = new ConcretePlayer();
				instance.testRemoveTrait(BFTraitsEnum.FERTILE);
				expect(CharacterTraitApi.removeTrait).not.toHaveBeenCalled();
			});

			it("should delegate to CharacterTraitApi when player is set", () => {
				const instance = new ConcretePlayer();
				instance.triggerOnCreatePlayer(mockPlayer);

				instance.testRemoveTrait(BFTraitsEnum.FERTILE);

				expect(CharacterTraitApi.removeTrait).toHaveBeenCalledWith(
					mockPlayer,
					BFTraitsEnum.FERTILE
				);
			});
		});

		describe("static hasTrait", () => {
			it("should return false when player is undefined", () => {
				const result = ConcretePlayer.hasTrait(undefined, BFTraitsEnum.FERTILE);
				expect(result).toBe(false);
				expect(CharacterTraitApi.hasTrait).not.toHaveBeenCalled();
			});

			it("should delegate to CharacterTraitApi when player is provided", () => {
				(CharacterTraitApi.hasTrait as jest.Mock).mockReturnValue(true);

				const result = ConcretePlayer.hasTrait(mockPlayer, BFTraitsEnum.FERTILE);

				expect(result).toBe(true);
				expect(CharacterTraitApi.hasTrait).toHaveBeenCalledWith(
					mockPlayer,
					BFTraitsEnum.FERTILE
				);
			});
		});
	});

	describe("data", () => {
		it("Should return null when modData is undefined", () => {
			const instance = new ConcretePlayer();
			(instance as any).data = undefined;
			expect(instance.data).toBeNull();
		});
		it("Should have defined data", () => {
			const instance = new ConcretePlayer("TEST_KEY");
			instance.triggerOnCreatePlayer(mockPlayer);
			instance.data = { foo: "mocked" };
			expect(instance.data).toBeDefined();
		});
		it("Should have defaultData", () => {
			const instance = new ConcretePlayer("TESTING_DEFAULTS", { default: "default" });
			instance.triggerOnCreatePlayer(mockPlayer);
			expect(instance.data).toBeDefined();
		});
		it("Should set defaultData when ModData initially returns null", () => {
			const instance = new ConcretePlayer("TEST_KEY", { initial: "data" });
			instance.triggerOnCreatePlayer(mockPlayer);
			// The line `if(!this.data && this.defaultData) this.data = this.defaultData;` should be executed
			expect(instance.data).toEqual({ initial: "data" });
		});
	});

	describe("applyDamage", () => {
		const setAdditionalPain = jest.fn();
		const getAdditionalPain = jest.fn().mockReturnValue(0);
		const setBleedingTime = jest.fn();
		const getBleedingTime = jest.fn().mockReturnValue(0);
		const setWetness = jest.fn();
		const getWetness = jest.fn().mockReturnValue(0);

		beforeEach(() => {
			jest.clearAllMocks();
			getAdditionalPain.mockReturnValue(0);
			getBleedingTime.mockReturnValue(0);
			getWetness.mockReturnValue(0);
			(mockBodyPart as any).getAdditionalPain = getAdditionalPain;
			(mockBodyPart as any).setAdditionalPain = setAdditionalPain;
			(mockBodyPart as any).getBleedingTime = getBleedingTime;
			(mockBodyPart as any).setBleedingTime = setBleedingTime;
			(mockBodyPart as any).getWetness = getWetness;
			(mockBodyPart as any).setWetness = setWetness;
		});

		class ConcretePlayerWithApplyDamage extends ConcretePlayer {
			public testApplyDamage(
				part: BodyPartType,
				options?: Partial<{ pain: number; bleedTime: number; wetness: number }>
			): void {
				this.applyBodyEffect(part, options);
			}
		}

		class ConcretePlayerWithApplyStat extends ConcretePlayer {
			public testApplyStatEffect(options: {
				stat: keyof typeof CharacterStat;
				value: number;
				maxValue?: number;
			}): void {
				this.applyStatEffect(options);
			}
		}

		it("should apply pain to a body part", () => {
			const instance = new ConcretePlayerWithApplyDamage("TEST_KEY");
			instance.triggerOnCreatePlayer(mockPlayer);
			instance.testApplyDamage(BodyPartType.Groin, { pain: 50 });
			expect(setAdditionalPain).toHaveBeenCalledWith(50);
		});

		it("should apply bleed time to a body part", () => {
			const instance = new ConcretePlayerWithApplyDamage("TEST_KEY");
			instance.triggerOnCreatePlayer(mockPlayer);
			instance.testApplyDamage(BodyPartType.Groin, { bleedTime: 10 });
			expect(setBleedingTime).toHaveBeenCalledWith(10);
		});

		it("should apply both pain and bleed time", () => {
			const instance = new ConcretePlayerWithApplyDamage("TEST_KEY");
			instance.triggerOnCreatePlayer(mockPlayer);
			instance.testApplyDamage(BodyPartType.Groin, { pain: 25, bleedTime: 5 });
			expect(setAdditionalPain).toHaveBeenCalledWith(25);
			expect(setBleedingTime).toHaveBeenCalledWith(5);
		});

		it("should add pain to existing pain", () => {
			getAdditionalPain.mockReturnValue(30);
			const instance = new ConcretePlayerWithApplyDamage("TEST_KEY");
			instance.triggerOnCreatePlayer(mockPlayer);
			instance.testApplyDamage(BodyPartType.Groin, { pain: 20 });
			expect(setAdditionalPain).toHaveBeenCalledWith(50); // 30 + 20
		});

		it("should add bleed time to existing bleed time", () => {
			getBleedingTime.mockReturnValue(5);
			const instance = new ConcretePlayerWithApplyDamage("TEST_KEY");
			instance.triggerOnCreatePlayer(mockPlayer);
			instance.testApplyDamage(BodyPartType.Groin, { bleedTime: 3 });
			expect(setBleedingTime).toHaveBeenCalledWith(8); // 5 + 3
		});

		it("should add wetness to existing wetness", () => {
			getWetness.mockReturnValue(10);
			const instance = new ConcretePlayerWithApplyDamage("TEST_KEY");
			instance.triggerOnCreatePlayer(mockPlayer);
			instance.testApplyDamage(BodyPartType.Groin, { wetness: 5 });
			expect(setWetness).toHaveBeenCalledWith(15); // 10 + 5
		});

		it("should not apply negative pain values", () => {
			const instance = new ConcretePlayerWithApplyDamage("TEST_KEY");
			instance.triggerOnCreatePlayer(mockPlayer);
			instance.testApplyDamage(BodyPartType.Groin, { pain: -10 });
			expect(setAdditionalPain).not.toHaveBeenCalled();
		});

		it("should not apply zero pain values", () => {
			const instance = new ConcretePlayerWithApplyDamage("TEST_KEY");
			instance.triggerOnCreatePlayer(mockPlayer);
			instance.testApplyDamage(BodyPartType.Groin, { pain: 0 });
			expect(setAdditionalPain).not.toHaveBeenCalled();
		});

		it("should not apply negative bleed time values", () => {
			const instance = new ConcretePlayerWithApplyDamage("TEST_KEY");
			instance.triggerOnCreatePlayer(mockPlayer);
			instance.testApplyDamage(BodyPartType.Groin, { bleedTime: -5 });
			expect(setBleedingTime).not.toHaveBeenCalled();
		});

		it("should not apply zero bleed time values", () => {
			const instance = new ConcretePlayerWithApplyDamage("TEST_KEY");
			instance.triggerOnCreatePlayer(mockPlayer);
			instance.testApplyDamage(BodyPartType.Groin, { bleedTime: 0 });
			expect(setBleedingTime).not.toHaveBeenCalled();
		});
		it("should not apply zero wetness values", () => {
			const instance = new ConcretePlayerWithApplyDamage("TEST_KEY");
			instance.triggerOnCreatePlayer(mockPlayer);
			instance.testApplyDamage(BodyPartType.Groin, { wetness: 0 });
			expect(setWetness).not.toHaveBeenCalled();
		});

		it("should not apply negative wetness values", () => {
			const instance = new ConcretePlayerWithApplyDamage("TEST_KEY");
			instance.triggerOnCreatePlayer(mockPlayer);
			instance.testApplyDamage(BodyPartType.Groin, { wetness: -5 });
			expect(setWetness).not.toHaveBeenCalled();
		});
		it("should do nothing if body part does not exist", () => {
			(mockBodyDamage.getBodyPart as jest.Mock).mockReturnValue(null);
			const instance = new ConcretePlayerWithApplyDamage("TEST_KEY");
			instance.triggerOnCreatePlayer(mockPlayer);
			instance.testApplyDamage(BodyPartType.Groin, { pain: 50 });
			expect(setAdditionalPain).not.toHaveBeenCalled();
			(mockBodyDamage.getBodyPart as jest.Mock).mockReturnValue(mockBodyPart);
		});

		it("should do nothing if player is not defined", () => {
			const instance = new ConcretePlayerWithApplyDamage("TEST_KEY");
			instance.testApplyDamage(BodyPartType.Groin, { pain: 50 });
			expect(setAdditionalPain).not.toHaveBeenCalled();
		});

		it("should do nothing if options are undefined", () => {
			const instance = new ConcretePlayerWithApplyDamage("TEST_KEY");
			instance.triggerOnCreatePlayer(mockPlayer);
			instance.testApplyDamage(BodyPartType.Groin);
			expect(setAdditionalPain).not.toHaveBeenCalled();
			expect(setBleedingTime).not.toHaveBeenCalled();
		});
	});

	describe("applyStatEffect", () => {
		const mockStats = mock<any>({
			get: jest.fn(),
			set: jest.fn()
		});

		class ConcretePlayerWithApplyStat extends ConcretePlayer {
			public testApplyStatEffect(options: {
				stat: any;
				value: number;
				maxValue?: number;
			}): void {
				this.applyStatEffect(options);
			}
		}

		beforeEach(() => {
			jest.clearAllMocks();
			(mockPlayer.getStats as jest.Mock).mockReturnValue(mockStats);
		});

		it("should apply stat increase with optional maxValue", () => {
			const mockStats = mock<any>({
				get: jest.fn().mockReturnValue(50),
				set: jest.fn()
			});
			(mockPlayer.getStats as jest.Mock).mockReturnValue(mockStats);

			const instance = new ConcretePlayerWithApplyStat("TEST_KEY");
			instance.triggerOnCreatePlayer(mockPlayer);

			instance.testApplyStatEffect({
				stat: "Fitness" as any,
				value: 20,
				maxValue: 100
			});

			expect(mockStats.set).toHaveBeenCalled();
		});

		it("should return early if player is not defined", () => {
			const instance = new ConcretePlayerWithApplyStat("TEST_KEY");
			const mockStats = mock<any>({
				get: jest.fn(),
				set: jest.fn()
			});

			expect(() =>
				instance.testApplyStatEffect({
					stat: "Fitness" as any,
					value: 20
				})
			).not.toThrow();
			expect(mockStats.set).not.toHaveBeenCalled();
		});

		it("should return early if stats is not available", () => {
			(mockPlayer.getStats as jest.Mock).mockReturnValue(null);
			const instance = new ConcretePlayerWithApplyStat("TEST_KEY");
			instance.triggerOnCreatePlayer(mockPlayer);

			const mockStats = mock<any>({
				get: jest.fn(),
				set: jest.fn()
			});

			expect(() =>
				instance.testApplyStatEffect({
					stat: "Fitness" as any,
					value: 20
				})
			).not.toThrow();
			expect(mockStats.set).not.toHaveBeenCalled();
		});

		it("should apply stat increase without maxValue", () => {
			const mockStats = mock<any>({
				get: jest.fn().mockReturnValue(30),
				set: jest.fn()
			});
			(mockPlayer.getStats as jest.Mock).mockReturnValue(mockStats);

			const instance = new ConcretePlayerWithApplyStat("TEST_KEY");
			instance.triggerOnCreatePlayer(mockPlayer);

			instance.testApplyStatEffect({
				stat: "Fitness" as any,
				value: 15
			});

			expect(mockStats.set).toHaveBeenCalled();
		});
	});
});
