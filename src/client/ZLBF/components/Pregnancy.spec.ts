/* eslint-disable @typescript-eslint/no-explicit-any */
import { IsoPlayer } from "@asledgehammer/pipewrench";
import { ITEMS, ZLBFEventsEnum, ZLBFTraitsEnum } from "@constants";
import { ISTimedActionQueue } from "@asledgehammer/pipewrench/client";
import * as Events from "@asledgehammer/pipewrench-events";
import { mock } from "jest-mock-extended";
import { Pregnancy } from "@client/components/Pregnancy";
import { Player } from "@client/components/Player";
import { PregnancyData } from "@types";
import * as SpyPipewrench from "@asledgehammer/pipewrench";
import { PregnancyOptions } from "@client/SandboxOptions";
import { PregnancyPublisher } from "@client/components/network/PregnancyPublisher";
import { SnapshotStore } from "@client/components/network/SnapshotStore";
import { PregnancyState } from "@client/components/PregnancyState";
import {
	createDefaultPregnancyState,
	PregnancyStatus
} from "@shared/domain/pregnancy/PregnancyState";

jest.mock("@actions/ZLBFBirth");
jest.mock("@actions/ZLBFPregnancyStartAnimation");
jest.mock("@client/components/Moodles");
jest.mock("@client/components/Player");
jest.mock("@asledgehammer/pipewrench");

describe("Pregnancy", () => {
	const modData = {};
	const player = mock<IsoPlayer>({
		setMaxWeightBase: jest.fn(),
		getModData: jest.fn(() => modData)
	});

	beforeEach(() => {
		jest.clearAllMocks();
		jest.resetAllMocks();
		let minuteStamp = 0;
		(SpyPipewrench.getGameTime as jest.Mock).mockReturnValue({
			getMinutesStamp: jest.fn(() => ++minuteStamp)
		});
		jest.spyOn(Events, "EventEmitter").mockReturnValue({ addListener: jest.fn() } as any);
	});

	describe("Player is not defined", () => {
		it("Should instantiate", () => {
			const pregnancy = new Pregnancy();
			expect(pregnancy).toBeDefined();
		});
		it("Birth should do nothing", () => {
			const pregnancy = new Pregnancy();
			const spy = jest.spyOn(pregnancy as any, "stop");
			pregnancy.birth();
			expect(spy).not.toHaveBeenCalled();
		});
	});

	// === Event System Tests ===
	describe("Event System", () => {
		describe("Timer Events", () => {
			describe.each([
				{ event: "everyOneMinute", handler: "onEveryMinute" },
				{ event: "everyHours", handler: "onEveryHour" },
				{ event: "everyDays", handler: "onEveryDay" }
			])("For $event", ({ event, handler }) => {
				const addListener = jest.fn();
				let pregnancy: Pregnancy;
				beforeEach(() => {
					addListener.mockClear();
					(Events as any)[event] = { addListener };
					pregnancy = new Pregnancy();
					(pregnancy as any)[handler] = jest.fn();
					(pregnancy as any).onCreatePlayer(player);
				});
				it(`should register ${event} listener during player creation`, () => {
					expect(addListener).toHaveBeenCalledWith(expect.any(Function));
				});
				it(`should call ${event} listener during player creation`, () => {
					const spy = jest.spyOn(pregnancy as any, handler);
					const [callback] = addListener.mock.calls[0];
					callback();
					expect(spy).toHaveBeenCalled();
				});
				it(`Should call ${event} without player`, () => {
					const artifact = new Pregnancy();
					(artifact as any)[handler]();
					expect(artifact).toBeDefined();
				});
			});
			describe("Every minute update", () => {
				const add = jest.spyOn(ISTimedActionQueue, "add");
				it("Should queue birth action only on the labor transition", () => {
					const mockModData = {};
					const mockPlayer = mock<IsoPlayer>({
						setBlockMovement: jest.fn(),
						getModData: jest.fn(() => mockModData)
					});
					const pregnancy = new Pregnancy();
					(pregnancy as any).player = mockPlayer;
					jest.spyOn(Pregnancy.prototype, "pregnancy", "get").mockReturnValue(
						mock<PregnancyData>({
							current: 14 * 24 * 60 - 1,
							progress: (14 * 24 * 60 - 1) / (14 * 24 * 60),
							isInLabor: false
						})
					);

					(pregnancy as any).onEveryMinute();
					expect(add).toHaveBeenCalledTimes(1);

					add.mockClear();
					jest.spyOn(Pregnancy.prototype, "pregnancy", "get").mockReturnValue(
						mock<PregnancyData>({
							current: 14 * 24 * 60,
							progress: 1,
							isInLabor: true
						})
					);
					(pregnancy as any).onEveryMinute();
					expect(add).not.toHaveBeenCalled();
				});

				it("should handle undefined isInLabor and apply nullish coalescing", () => {
					const mockModData = {};
					const mockPlayer = mock<IsoPlayer>({
						setBlockMovement: jest.fn(),
						getModData: jest.fn(() => mockModData)
					});
					const pregnancy = new Pregnancy();
					(pregnancy as any).player = mockPlayer;
					jest.spyOn(PregnancyOptions, "duration", "get").mockReturnValue(10);
					jest.spyOn(Pregnancy.prototype, "pregnancy", "get").mockReturnValue(
						mock<PregnancyData>({
							current: 5,
							progress: 0.5
							// isInLabor is undefined - should use ?? false
						})
					);
					const add = jest.spyOn(ISTimedActionQueue, "add");
					(pregnancy as any).onEveryMinute();
					expect(add).not.toHaveBeenCalled();
				});

				it("should use current + 1 when it is less than duration", () => {
					const mockModData = {};
					const mockPlayer = mock<IsoPlayer>({
						setBlockMovement: jest.fn(),
						getModData: jest.fn(() => mockModData)
					});
					const pregnancy = new Pregnancy();
					(pregnancy as any).player = mockPlayer;
					// Set duration to be large, so current + 1 < duration is true
					jest.spyOn(PregnancyOptions, "duration", "get").mockReturnValue(1000);
					jest.spyOn(Pregnancy.prototype, "pregnancy", "get").mockReturnValue(
						mock<PregnancyData>({
							current: 5,
							progress: 0.005,
							isInLabor: false
						})
					);
					const add = jest.spyOn(ISTimedActionQueue, "add");
					(pregnancy as any).onEveryMinute();
					// Since updated = Math.min(1000, 6) = 6, and isInLabor = (6 != 1000) = false
					expect(add).not.toHaveBeenCalled();
				});

				it("should not queue birth when both isInLabor and previousInLabor are true", () => {
					const mockModData = {};
					const mockPlayer = mock<IsoPlayer>({
						setBlockMovement: jest.fn(),
						getModData: jest.fn(() => mockModData)
					});
					const pregnancy = new Pregnancy();
					(pregnancy as any).player = mockPlayer;
					jest.spyOn(PregnancyOptions, "duration", "get").mockReturnValue(10);
					jest.spyOn(Pregnancy.prototype, "pregnancy", "get").mockReturnValue(
						mock<PregnancyData>({
							current: 10, // At end of pregnancy
							progress: 1,
							isInLabor: true // Already in labor
						})
					);
					const add = jest.spyOn(ISTimedActionQueue, "add");
					(pregnancy as any).onEveryMinute();
					// isInLabor = (Math.min(10, 11) == 10) = true, previousInLabor = true
					// if (true && !true) = false, so add() should not be called
					expect(add).not.toHaveBeenCalled();
				});

				it("should call moodle when it exists during onEveryMinute", () => {
					const mockModData = {};
					const mockPlayer = mock<IsoPlayer>({
						setBlockMovement: jest.fn(),
						getModData: jest.fn(() => mockModData)
					});
					const pregnancy = new Pregnancy();
					(pregnancy as any).player = mockPlayer;
					jest.spyOn(PregnancyOptions, "duration", "get").mockReturnValue(10);
					const moodleMock = jest.fn();
					(pregnancy as any).moodle = { moodle: moodleMock };
					jest.spyOn(Pregnancy.prototype, "pregnancy", "get").mockReturnValue(
						mock<PregnancyData>({
							current: 5,
							progress: 0.5,
							isInLabor: false
						})
					);
					(pregnancy as any).onEveryMinute();
					expect(moodleMock).toHaveBeenCalledWith(0.5, true);
				});

				it("should handle null isInLabor by using false for previousInLabor", () => {
					const mockModData = {};
					const mockPlayer = mock<IsoPlayer>({
						setBlockMovement: jest.fn(),
						getModData: jest.fn(() => mockModData)
					});
					const pregnancy = new Pregnancy();
					(pregnancy as any).player = mockPlayer;
					jest.spyOn(PregnancyOptions, "duration", "get").mockReturnValue(10);
					jest.spyOn(Pregnancy.prototype, "pregnancy", "get").mockReturnValue(
						mock<PregnancyData>({
							current: 5,
							progress: 0.5,
							isInLabor: null as any // Explicitly null
						})
					);
					const add = jest.spyOn(ISTimedActionQueue, "add");
					(pregnancy as any).onEveryMinute();
					// previousInLabor should be false (from the null fallback)
					// isInLabor = (Math.min(10, 6) == 10) = false
					// if (false && !false) = false
					expect(add).not.toHaveBeenCalled();
				});

				it("should use true value when isInLabor is true (not null/undefined)", () => {
					const mockModData = {};
					const mockPlayer = mock<IsoPlayer>({
						setBlockMovement: jest.fn(),
						getModData: jest.fn(() => mockModData)
					});
					const pregnancy = new Pregnancy();
					(pregnancy as any).player = mockPlayer;
					jest.spyOn(PregnancyOptions, "duration", "get").mockReturnValue(10);
					jest.spyOn(Pregnancy.prototype, "pregnancy", "get").mockReturnValue(
						mock<PregnancyData>({
							current: 9,
							progress: 0.9,
							isInLabor: true // Non-null, true value
						})
					);
					const add = jest.spyOn(ISTimedActionQueue, "add");
					(pregnancy as any).onEveryMinute();
					// previousInLabor = true (from the true value, not null/undefined)
					// updated = Math.min(10, 10) = 10
					// isInLabor = (10 == 10) = true
					// if (true && !true) = false (since previousInLabor is true)
					expect(add).not.toHaveBeenCalled();
				});

				it("should handle undefined isInLabor explicitly", () => {
					const mockModData = {};
					const mockPlayer = mock<IsoPlayer>({
						setBlockMovement: jest.fn(),
						getModData: jest.fn(() => mockModData)
					});
					const pregnancy = new Pregnancy();
					(pregnancy as any).player = mockPlayer;
					jest.spyOn(PregnancyOptions, "duration", "get").mockReturnValue(10);
					jest.spyOn(Pregnancy.prototype, "pregnancy", "get").mockReturnValue(
						mock<PregnancyData>({
							current: 3,
							progress: 0.3,
							isInLabor: undefined as any // Explicitly undefined
						})
					);
					const add = jest.spyOn(ISTimedActionQueue, "add");
					(pregnancy as any).onEveryMinute();
					// previousInLabor should be false (from undefined ?? false)
					// updated should be 4 (current + 1)
					// isInLabor = (4 == 10) = false
					// if (false && !false) = false
					expect(add).not.toHaveBeenCalled();
				});

				it("should use default current = 0 when current is undefined", () => {
					const mockModData = {};
					const mockPlayer = mock<IsoPlayer>({
						setBlockMovement: jest.fn(),
						getModData: jest.fn(() => mockModData)
					});
					const pregnancy = new Pregnancy();
					(pregnancy as any).player = mockPlayer;
					jest.spyOn(PregnancyOptions, "duration", "get").mockReturnValue(10);
					jest.spyOn(Pregnancy.prototype, "pregnancy", "get").mockReturnValue(
						mock<PregnancyData>({
							// current is undefined - should use default = 0
							progress: 0,
							isInLabor: false
						})
					);
					const add = jest.spyOn(ISTimedActionQueue, "add");
					(pregnancy as any).onEveryMinute();
					// current defaults to 0, so updated = 0 + 1 = 1
					// isInLabor = (1 == 10) = false
					expect(add).not.toHaveBeenCalled();
				});

				it("should cap updated at duration when current + 1 exceeds duration", () => {
					const mockModData = {};
					const mockPlayer = mock<IsoPlayer>({
						setBlockMovement: jest.fn(),
						getModData: jest.fn(() => mockModData)
					});
					const pregnancy = new Pregnancy();
					(pregnancy as any).player = mockPlayer;
					// Set duration to 5, current to 5: current + 1 = 6 > 5
					jest.spyOn(PregnancyOptions, "duration", "get").mockReturnValue(5);
					jest.spyOn(Pregnancy.prototype, "pregnancy", "get").mockReturnValue(
						mock<PregnancyData>({
							current: 5,
							progress: 1,
							isInLabor: false
						})
					);
					const add = jest.spyOn(ISTimedActionQueue, "add");
					(pregnancy as any).onEveryMinute();
					// updated should be capped at 5 (duration), not 6
					// isInLabor = (5 == 5) = true, previousInLabor = false
					// if (true && !false) = true
					expect(add).toHaveBeenCalledTimes(1);
				});
			});

			describe("Every Hour update", () => {
				const setStat = jest.fn();
				const getStat = jest.fn();
				const setCalories = jest.fn();
				const hourModData = {};
				let pregnancy: Pregnancy;
				beforeEach(() => {
					setStat.mockReset();
					getStat.mockReset();
					getStat.mockReturnValue(0);
					pregnancy = new Pregnancy();
					(pregnancy as any).onCreatePlayer({
						...player,
						getModData: jest.fn(() => hourModData),
						getStats: () => ({
							set: setStat,
							get: getStat
						}),
						getNutrition: () => ({
							setCalories,
							getCalories: () => 0
						})
					});
				});
				it("Should call moodle", () => {
					const moodle = jest.fn();
					const moodleModData = {};
					const testPregnancy = new Pregnancy();
					(testPregnancy as any).onCreatePlayer({
						...player,
						getModData: jest.fn(() => moodleModData),
						getStats: () => ({
							set: jest.fn(),
							get: jest.fn().mockReturnValue(0)
						}),
						getNutrition: () => ({
							setCalories: jest.fn(),
							getCalories: () => 0
						})
					});
					(testPregnancy as any).moodle = { moodle };
					jest.spyOn(Pregnancy.prototype, "pregnancy", "get").mockReturnValue(
						mock<PregnancyData>({ progress: 0.5 })
					);
					(testPregnancy as any).onEveryHour();

					expect(moodle).toHaveBeenCalled();
				});
				it.each([
					{
						progress: 0,
						expected: () => {
							expect(setStat).not.toHaveBeenCalled();
							expect(setCalories).not.toHaveBeenCalled();
						}
					},
					{
						progress: 0.5,
						expected: () => {
							expect(setStat).toHaveBeenCalled();
							expect(setCalories).toHaveBeenCalled();
						}
					}
				])(
					"should call appropriate effects when pregnancy progress is $progres",
					({ progress, expected }) => {
						jest.spyOn(Pregnancy.prototype, "pregnancy", "get").mockReturnValue(
							mock<PregnancyData>({ progress })
						);

						pregnancy.onEveryHour();

						expected();
					}
				);
			});
			describe("Every Day update", () => {
				const setFoodSicknessLevel = jest.fn();
				let pregnancy: Pregnancy;
				const dayModData = {};
				beforeEach(() => {
					pregnancy = new Pregnancy();
					(pregnancy as any).onCreatePlayer({
						...player,
						getModData: jest.fn(() => dayModData),
						getBodyDamage: () => ({ setFoodSicknessLevel })
					});
				});

				it.each([
					{
						progress: 0.01,
						expected: () => expect(setFoodSicknessLevel).not.toHaveBeenCalled()
					},
					{
						progress: 0.34,
						expected: () => expect(setFoodSicknessLevel).not.toHaveBeenCalled()
					},
					{
						progress: 0.06,
						expected: () => expect(setFoodSicknessLevel).toHaveBeenCalled()
					}
				])(
					"should call appropriate effects when pregnancy progress is $progress",
					({ progress, expected }) => {
						jest.spyOn(Pregnancy.prototype, "pregnancy", "get").mockReturnValue(
							mock<PregnancyData>({ progress })
						);
						pregnancy.onEveryDay();
						expected();
					}
				);
			});
		});
		describe("Custom Events", () => {
			const addListener = jest.fn();
			const listener = jest.fn();
			const queueAdd = jest.spyOn(ISTimedActionQueue, "add");
			beforeEach(() => {
				(Events.EventEmitter as jest.Mock).mockImplementation(() => ({
					addListener
				}));
				addListener.mockClear();
				queueAdd.mockClear();
				jest.spyOn(Player.prototype as any, "addTrait").mockImplementation(listener);
				jest.spyOn(Player.prototype as any, "removeTrait").mockImplementation(listener);
				jest.spyOn(Player.prototype as any, "applyBodyEffect").mockImplementation(listener);
			});
			it.each([
				{ name: ZLBFEventsEnum.PREGNANCY_START, index: 0 },
				{ name: ZLBFEventsEnum.PREGNANCY_STOP, index: 1 },
				{ name: ZLBFEventsEnum.PREGNANCY_LABOR, index: 2 }
			])("should call listener for $name", ({ index }) => {
				const pregnancy = new Pregnancy();
				(pregnancy as any).onCreatePlayer(
					mock({
						getModData: jest.fn(() => ({}))
					})
				);
				const [callback] = addListener.mock.calls[index];
				callback();
				expect(listener).toHaveBeenCalled();
			});

			it("should queue pregnancy-start animation timed action on PREGNANCY_START", () => {
				const pregnancy = new Pregnancy();
				(pregnancy as any).onCreatePlayer(
					mock({
						getModData: jest.fn(() => ({}))
					})
				);

				const [callback] = addListener.mock.calls[0];
				callback();

				expect(queueAdd).toHaveBeenCalledTimes(1);
			});
		});
	});

	// === PREGNANCY_UPDATE Event ===
	describe("PREGNANCY_UPDATE Event", () => {
		it("should trigger PREGNANCY_UPDATE with entire data object during onEveryMinute", () => {
			const mockTrigger = jest.spyOn(SpyPipewrench, "triggerEvent");
			const updateModData = {};
			const mockPlayer = mock<IsoPlayer>({
				setBlockMovement: jest.fn(),
				getModData: jest.fn(() => updateModData)
			});
			const pregnancy = new Pregnancy();
			(pregnancy as any).onCreatePlayer(mockPlayer);

			const testData = mock<PregnancyData>({
				current: 100,
				progress: 0.5,
				isInLabor: false
			});

			// Set both the data property and pregnancy getter to ensure test works
			Object.defineProperty(pregnancy, "data", {
				value: testData,
				writable: true,
				configurable: true
			});
			jest.spyOn(Pregnancy.prototype, "pregnancy", "get").mockReturnValue(testData);

			(pregnancy as any).onEveryMinute();

			const updateCalls = mockTrigger.mock.calls.filter(
				call => call[0] === "ZLBFPregnancyUpdate"
			);
			expect(updateCalls.length).toBeGreaterThan(0);
			expect(updateCalls[0][1]).toEqual(testData);
		});
	});

	// === Methods ===
	describe("Methods", () => {
		it("Birth should remove Pregnancy trait and add baby item", () => {
			const removeTrait = jest.fn();
			const AddItem = jest.fn();
			const pregnancy = new Pregnancy();
			jest.spyOn(Player.prototype as any, "removeTrait").mockImplementation(removeTrait);
			(pregnancy as any).onCreatePlayer(
				mock({
					getModData: jest.fn(() => ({})),
					getInventory: () => ({ AddItem })
				})
			);
			pregnancy.birth();
			expect(removeTrait).toHaveBeenCalledWith(ZLBFTraitsEnum.PREGNANCY);
			expect(AddItem).toHaveBeenCalledWith(ITEMS.BABY);
		});
	});

	// === Debug Functions ===
	describe("Debug", () => {
		it("publishes elapsed online Pregnancy progress from the minute-stamp delta", () => {
			jest.restoreAllMocks();
			(SpyPipewrench.getGameTime as jest.Mock).mockReturnValue({
				getMinutesStamp: jest.fn().mockReturnValue(13)
			});
			jest.spyOn(PregnancyOptions, "duration", "get").mockReturnValue(100);
			jest.spyOn(Player.prototype as any, "addTrait").mockImplementation(jest.fn());
			const commands = mock<PregnancyPublisher>({
				publishState: jest.fn(),
				latestDesiredState: undefined
			});
			const snapshots = new SnapshotStore();
			const pregnancy = new Pregnancy(commands, snapshots);
			const store: Record<string, unknown> = {};
			(pregnancy as any).player = mock<IsoPlayer>({
				getModData: jest.fn(() => store)
			});
			(pregnancy as any).lastMinuteStamp = 10;
			snapshots.apply({
				dataSchemaVersion: 2,
				stateVersion: 1,
				domains: {
					pregnancy: {
						status: PregnancyStatus.PREGNANT,
						current: 5,
						progress: 0.05,
						isInLabor: false
					}
				}
			});

			pregnancy.onEveryMinute();

			expect(commands.publishState).toHaveBeenCalledWith({
				status: PregnancyStatus.PREGNANT,
				current: 8,
				progress: 0.08,
				isInLabor: false
			});
		});

		it("keeps authoritative Pregnancy present when multiplayer removes the local trait", () => {
			jest.restoreAllMocks();
			const snapshots = new SnapshotStore();
			const pregnancy = new Pregnancy(undefined, snapshots);
			const store: Record<string, unknown> = {};
			const localPlayer = mock<IsoPlayer>({ getModData: jest.fn(() => store) });
			(pregnancy as any).player = localPlayer;
			const data = { current: 12, progress: 0.25, isInLabor: false };
			jest.spyOn(PregnancyState, "get").mockReturnValue(null);
			snapshots.apply({
				dataSchemaVersion: 2,
				stateVersion: 1,
				domains: {
					pregnancy: { status: PregnancyStatus.PREGNANT, ...data }
				}
			});

			expect(pregnancy.pregnancy).toEqual(data);
			expect(PregnancyState.get).not.toHaveBeenCalled();
		});

		it("does not roll presentation back behind a newer queued desired state", () => {
			jest.restoreAllMocks();
			jest.spyOn(Player.prototype as any, "addTrait").mockImplementation(jest.fn());
			const desired = {
				status: PregnancyStatus.PREGNANT,
				current: 2,
				progress: 0.02,
				isInLabor: false
			};
			const commands = {
				latestDesiredState: desired,
				setState: jest.fn(),
				publishState: jest.fn(),
				onServerCommand: jest.fn()
			} as unknown as PregnancyPublisher;
			const snapshots = new SnapshotStore();
			const pregnancy = new Pregnancy(commands, snapshots);
			const store: Record<string, unknown> = {};
			(pregnancy as any).player = mock<IsoPlayer>({
				getModData: jest.fn(() => store)
			});

			snapshots.apply({
				dataSchemaVersion: 2,
				stateVersion: 2,
				domains: {
					pregnancy: { ...desired, current: 1, progress: 0.01 }
				}
			});

			expect(pregnancy.pregnancy).toEqual({
				current: 2,
				progress: 0.02,
				isInLabor: false
			});
		});

		it("routes start and stop through the authoritative Pregnancy publisher", () => {
			const commands = mock<PregnancyPublisher>({ setState: jest.fn() });
			const pregnancy = new Pregnancy(commands, new SnapshotStore());

			pregnancy.Debug.start();
			expect(commands.setState).toHaveBeenCalledWith({
				...createDefaultPregnancyState(),
				status: PregnancyStatus.PREGNANT
			});

			pregnancy.Debug.stop();
			expect(commands.setState).toHaveBeenLastCalledWith(createDefaultPregnancyState());
		});

		it("routes progress changes through the authoritative Pregnancy publisher", () => {
			const commands = mock<PregnancyPublisher>({ setState: jest.fn() });
			const snapshots = new SnapshotStore();
			const pregnancy = new Pregnancy(commands, snapshots);
			jest.spyOn(PregnancyOptions, "duration", "get").mockReturnValue(14 * 24 * 60);
			snapshots.apply({
				dataSchemaVersion: 2,
				stateVersion: 1,
				domains: {
					pregnancy: {
						status: PregnancyStatus.PREGNANT,
						current: 0,
						progress: 0,
						isInLabor: false
					}
				}
			});

			pregnancy.Debug.advance(60);

			expect(commands.setState).toHaveBeenCalledWith({
				status: PregnancyStatus.PREGNANT,
				current: 60,
				progress: 60 / (14 * 24 * 60),
				isInLabor: false
			});
		});

		describe("Pregnancy data not defined", () => {
			let pregnancy: Pregnancy;
			beforeEach(() => {
				pregnancy = new Pregnancy();
				// Mock PregnancyOptions to use a smaller duration for testing
				jest.resetModules();
			});
			it.each<{
				method: "advance" | "advanceToLabor";
				data: PregnancyData | null;
				args?: number;
				expected: () => void;
			}>([
				{
					method: "advance",
					data: null,
					args: 10,
					expected: () => undefined
				},
				{
					method: "advanceToLabor",
					data: null,
					expected: () => undefined
				},
				{
					method: "advance",
					data: mock<PregnancyData>({ current: undefined }),
					args: 10,
					expected: () => undefined
				},
				{
					method: "advanceToLabor",
					data: mock<PregnancyData>({ current: undefined }),
					expected: () => undefined
				}
			])(
				"Method $method should have expected result when data is $data",
				({ method, data, args }) => {
					jest.spyOn(Pregnancy.prototype, "pregnancy", "get").mockReturnValue(data);
					pregnancy.Debug[method](args as never);
					if (data !== null) {
						expect(pregnancy).toBeDefined();
					}
				}
			);
		});
	});
});
