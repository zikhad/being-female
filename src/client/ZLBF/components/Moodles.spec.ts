

describe("Moodle fallback and onlyMoodleFramework logic", () => {
	let player: IsoPlayer;
	beforeEach(() => {
		jest.clearAllMocks();
		(globalThis as any).MF = undefined;
		player = mock<IsoPlayer>({
			getUsername: jest.fn(() => "tester")
		});
	});

	it("should NOT fallback if MF is inactive and onlyMoodleFramework is true", () => {
		jest.spyOn(SpyPipewrench, "getActivatedMods").mockImplementation(() =>
			mock<ArrayList>({
				contains: jest.fn().mockReturnValue(false)
			})
		);
		const fallbackSpy = jest.spyOn(Moodle.prototype as any, "fallbackMoodle");
		const moodle = new Moodle({
			name: "TestMoodle",
			player,
			texture: "test_texture.png",
			type: "Good",
			tresholds: [0, 0.25, 0.5, 0.75]
		});
		moodle.moodle(0.5, true);
		expect(fallbackSpy).not.toHaveBeenCalled();
	});

	it("should NOT fallback if MF is active but getMoodle returns undefined and onlyMoodleFramework is true", () => {
		jest.spyOn(SpyPipewrench, "getActivatedMods").mockImplementation(() =>
			mock<ArrayList>({
				contains: jest.fn().mockReturnValue(true)
			})
		);
		Object.defineProperty(SpyPipewrench, "getTexture", {
			value: jest.fn().mockReturnValue({}),
			writable: true
		});
		Object.defineProperty(SpyPipewrench, "require", {
			value: jest.fn(),
			writable: true
		});
		(globalThis as any).MF = {
			createMoodle: jest.fn(),
			ISMoodle: { new: jest.fn() },
			getMoodle: jest.fn(() => undefined)
		};
		const fallbackSpy = jest.spyOn(Moodle.prototype as any, "fallbackMoodle");
		const moodle = new Moodle({
			name: "TestMoodle",
			player,
			texture: "test_texture.png",
			type: "Good",
			tresholds: [0, 0.25, 0.5, 0.75]
		});
		moodle.moodle(0.5, true);
		expect(fallbackSpy).not.toHaveBeenCalled();
		// Clean up global
		// @ts-ignore
		delete (globalThis as any).MF;
	});

	it("should fallback if MF is active, getMoodle returns undefined, and onlyMoodleFramework is false", () => {
		jest.spyOn(SpyPipewrench, "getActivatedMods").mockImplementation(() =>
			mock<ArrayList>({
				contains: jest.fn().mockReturnValue(true)
			})
		);
		Object.defineProperty(SpyPipewrench, "getTexture", {
			value: jest.fn().mockReturnValue({}),
			writable: true
		});
		Object.defineProperty(SpyPipewrench, "require", {
			value: jest.fn(),
			writable: true
		});
		(globalThis as any).MF = {
			createMoodle: jest.fn(),
			ISMoodle: { new: jest.fn() },
			getMoodle: jest.fn(() => undefined)
		};
		const fallbackSpy = jest.spyOn(Moodle.prototype as any, "fallbackMoodle");
		const moodle = new Moodle({
			name: "TestMoodle",
			player,
			texture: "test_texture.png",
			type: "Good",
			tresholds: [0, 0.25, 0.5, 0.75]
		});

		moodle.moodle(0.5);
		expect(fallbackSpy).toHaveBeenCalledWith(0.5);

		// Clean up global
		// @ts-ignore
		delete (globalThis as any).MF;
	});

	it("should not crash when MF mod is active but MF global is missing", () => {
		jest.spyOn(SpyPipewrench, "getActivatedMods").mockImplementation(() =>
			mock<ArrayList>({
				contains: jest.fn().mockReturnValue(true)
			})
		);
		Object.defineProperty(SpyPipewrench, "require", {
			value: jest.fn(),
			writable: true
		});
		Object.defineProperty(SpyPipewrench, "getTexture", {
			value: jest.fn().mockReturnValue({}),
			writable: true
		});

		// Simulate optional dependency not loaded at runtime.
		(globalThis as any).MF = undefined;

		const fallbackSpy = jest.spyOn(Moodle.prototype as any, "fallbackMoodle");
		const moodle = new Moodle({
			name: "TestMoodle",
			player,
			texture: "test_texture.png",
			type: "Good",
			tresholds: [0, 0.25, 0.5, 0.75]
		});

		expect(() => moodle.moodle(0.5)).not.toThrow();
		expect(fallbackSpy).toHaveBeenCalledWith(0.5);
	});

	it("should not crash when MF global is present but missing required functions", () => {
		jest.spyOn(SpyPipewrench, "getActivatedMods").mockImplementation(() =>
			mock<ArrayList>({
				contains: jest.fn().mockReturnValue(true)
			})
		);
		Object.defineProperty(SpyPipewrench, "require", {
			value: jest.fn(),
			writable: true
		});

		(globalThis as any).MF = {
			createMoodle: null,
			ISMoodle: null,
			getMoodle: null
		};

		const fallbackSpy = jest.spyOn(Moodle.prototype as any, "fallbackMoodle");
		const moodle = new Moodle({
			name: "TestMoodle",
			player,
			texture: "test_texture.png",
			type: "Good",
			tresholds: [0, 0.25, 0.5, 0.75]
		});

		expect(() => moodle.moodle(0.5)).not.toThrow();
		expect(fallbackSpy).toHaveBeenCalledWith(0.5);

		// @ts-ignore
		delete (globalThis as any).MF;
	});
});
describe("MoodleFramework active: moodle can be called more often", () => {
	let player: any;
	let mfMoodle: any;
	beforeEach(() => {
		player = { id: 1, getUsername: jest.fn(() => "tester") };
		jest.spyOn(SpyPipewrench, "getActivatedMods").mockImplementation(() =>
			mock<ArrayList>({
				contains: jest.fn().mockImplementation((mod: string) => mod === "MoodleFramework")
			})
		);
		Object.defineProperty(SpyPipewrench, "getTexture", {
			value: jest.fn().mockReturnValue({
				addDependency: jest.fn(),
				bind: jest.fn(),
				copyMaskRegion: jest.fn(),
				createMask: jest.fn(),
			} as unknown as MFTexture),
			writable: true
		});
		Object.defineProperty(SpyPipewrench, "require", {
			value: jest.fn(),
			writable: true
		});
		mfMoodle = {
			setThresholds: jest.fn(),
			setPicture: jest.fn(),
			getGoodBadNeutral: jest.fn(() => 2),
			getLevel: jest.fn(() => 1),
			setValue: jest.fn()
		};
		(globalThis as any).MF = {
			createMoodle: jest.fn(),
			ISMoodle: { new: jest.fn() },
			getMoodle: jest.fn(() => mfMoodle)
		};
	});
	afterEach(() => {
		jest.restoreAllMocks();
		// @ts-ignore
		delete (globalThis as any).MF;
	});
	it("should call MF moodle logic every time moodle() is called", () => {
		const moodle = new Moodle({
			name: "TestMoodle",
			player,
			texture: "test_texture.png",
			type: "Good",
			tresholds: [0, 0.25, 0.5, 0.75]
		});
		moodle.moodle(0.1);
		moodle.moodle(0.2);
		moodle.moodle(0.3);
		expect(mfMoodle.setValue).toHaveBeenCalledTimes(3);
		expect(mfMoodle.setThresholds).toHaveBeenCalled();
	});
	it("should not fallback to HaloText when MF is active", () => {
		const fallbackSpy = jest.spyOn(Moodle.prototype as any, "fallbackMoodle");
		const moodle = new Moodle({
			name: "TestMoodle",
			player,
			texture: "test_texture.png",
			type: "Good",
			tresholds: [0, 0.25, 0.5, 0.75]
		});
		moodle.moodle(0.5);
		expect(fallbackSpy).not.toHaveBeenCalled();
	});
});
/* eslint-disable @typescript-eslint/no-explicit-any */
import { mock } from "jest-mock-extended";
import { Moodle } from "@client/components/Moodles";
import * as SpyPipewrench from "@asledgehammer/pipewrench";
import { IsoPlayer, ArrayList } from "@asledgehammer/pipewrench";

// jest.mock("MF_ISMoodle");
describe("Moodles", () => {
	const player = mock<IsoPlayer>({
		getUsername: jest.fn(() => "tester")
	});
	beforeEach(() => {
		jest.clearAllMocks();
	});
	describe("MoodleFramework is active", () => {
		const createMoodle = jest.fn();
		const moodleNew = jest.fn();
		const texture = { id: "texture" } as any;
		const getMoodle = jest.fn(() => ({
			setThresholds: jest.fn(),
			setPicture: jest.fn(),
			getGoodBadNeutral: jest.fn(() => 1),
			getLevel: jest.fn(() => 2),
			setValue: jest.fn()
		}));
		beforeEach(() => {
			Object.defineProperty(SpyPipewrench, "require", {
				value: jest.fn(),
				writable: true
			});
			Object.defineProperty(SpyPipewrench, "getTexture", {
				value: jest.fn().mockReturnValue(texture),
				writable: true
			});
			(globalThis as any).MF = {
				ISMoodle: { new: moodleNew },
				createMoodle,
				getMoodle
			};
			jest.spyOn(SpyPipewrench, "getActivatedMods").mockImplementation(() =>
				mock<ArrayList>({
					contains: jest.fn().mockImplementation(() => true)
				})
			);
		});
		it.each<{ type: "Good" | "Bad" }>([{ type: "Good" }, { type: "Bad" }])(
			"should create a $type Moodle instance with correct properties",
			({ type }) => {
				const moodle = new Moodle({
					name: "TestMoodle",
					player,
					texture: "test_texture.png",
					type,
					tresholds: [0, 0.25, 0.5, 0.75]
				});
				expect(moodle).toBeDefined();
				expect(createMoodle).toHaveBeenCalledWith("TestMoodle");
			}
		);
		it.each<{ type: "Good" | "Bad" }>([{ type: "Good" }, { type: "Bad" }])(
			"should directly instantiate the MF moodle for the current player on $type creation",
			({ type }) => {
				new Moodle({
					name: "TestMoodle",
					player,
					texture: "test_texture.png",
					type,
					tresholds: [0, 0.25, 0.5, 0.75]
				});
				// Verifies the timing fix: MF.ISMoodle:new is called immediately so the moodle
				// exists even when the constructor runs inside OnCreatePlayer.
				expect(moodleNew).toHaveBeenCalledWith(expect.anything(), "TestMoodle", player);
			}
		);
		it.each<{ type: "Good" | "Bad" }>([{ type: "Good" }, { type: "Bad" }])(
			"Should call MF methods when a $type moodle is call",
			({ type }) => {
				const moodle = new Moodle({
					name: "TestMoodle",
					player,
					texture: "test_texture.png",
					type,
					tresholds: [0, 0.25, 0.5, 0.75]
				});
				moodle.moodle(0.5);
				expect(getMoodle).toHaveBeenCalledWith("TestMoodle");
				expect(getMoodle.mock.results.at(-1)?.value.setThresholds).toHaveBeenCalled();
				expect(getMoodle.mock.results.at(-1)?.value.setValue).toHaveBeenCalled();
			}
		);
		it("should normalize percentage inputs before passing the value to MF", () => {
			const moodleApi = {
				setThresholds: jest.fn(),
				setPicture: jest.fn(),
				getGoodBadNeutral: jest.fn(() => 2),
				getLevel: jest.fn(() => 1),
				setValue: jest.fn()
			};
			getMoodle.mockReturnValueOnce(moodleApi);

			const moodle = new Moodle({
				name: "Engorgement",
				player,
				texture: "test_texture.png",
				type: "Bad",
				tresholds: [0.3, 0.6, 0.8, 0.9]
			});

			moodle.moodle(28);
			expect(moodleApi.setValue).toHaveBeenCalledWith(0.72);
			expect(moodleApi.setThresholds).toHaveBeenCalledTimes(1);
			const [bad4, bad3, bad2, bad1, good1, good2, good3, good4] = moodleApi.setThresholds.mock.calls[0];
			expect(bad4).toBeCloseTo(0.1);
			expect(bad3).toBeCloseTo(0.2);
			expect(bad2).toBeCloseTo(0.4);
			expect(bad1).toBeCloseTo(0.7);
			expect(good1).toBeUndefined();
			expect(good2).toBeUndefined();
			expect(good3).toBeUndefined();
			expect(good4).toBeUndefined();
		});
		it("should skip picture override when the texture path cannot be resolved", () => {
			Object.defineProperty(SpyPipewrench, "getTexture", {
				value: jest.fn().mockReturnValue(undefined),
				writable: true
			});
			const moodleApi = {
				setThresholds: jest.fn(),
				setPicture: jest.fn(),
				getGoodBadNeutral: jest.fn(() => 1),
				getLevel: jest.fn(() => 2),
				setValue: jest.fn()
			};
			getMoodle.mockReturnValueOnce(moodleApi);

			const moodle = new Moodle({
				name: "TestMoodle",
				player,
				texture: "missing_texture.png",
				type: "Good",
				tresholds: [0, 0.25, 0.5, 0.75]
			});

			moodle.moodle(0.5);
			expect(moodleApi.setPicture).not.toHaveBeenCalled();
			}
		);
	});
	describe("MoodleFramework is inactive", () => {
		beforeEach(() => {
			(globalThis as any).MF = undefined;
			jest.spyOn(SpyPipewrench, "getActivatedMods").mockImplementation(() =>
				mock<ArrayList>({
					contains: jest.fn().mockImplementation(() => false)
				})
			);
		});
		it.each<{ type: "Good" | "Bad" }>([{ type: "Good" }, { type: "Bad" }])(
			"Should call a HaloText as Fallback for a $type moodle",
			({ type }) => {
				const method = type === "Good" ? "addGoodText" : "addBadText";
				const spy = jest.spyOn(SpyPipewrench.HaloTextHelper, method as "addGoodText" | "addBadText");
				const getTextSpy = jest.spyOn(SpyPipewrench, "getText").mockReturnValue("localized text");
				const moodle = new Moodle({
					name: "TestMoodle",
					player,
					texture: "test_texture.png",
					type,
					tresholds: [0, 0.25, 0.5, 0.75]
				});
				moodle.moodle(0.5);
				expect(spy).toHaveBeenCalled();
				expect(getTextSpy).toHaveBeenCalledWith(`Moodles_TestMoodle_${type}_desc_lvl3`);
			}
		);
	});
});
