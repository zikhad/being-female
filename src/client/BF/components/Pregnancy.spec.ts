/* eslint-disable @typescript-eslint/no-explicit-any */
import { IsoPlayer } from "@asledgehammer/pipewrench";
import { ITEMS, BFEventsEnum, BFTraitsEnum } from "@constants";
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
	AuthoritativePregnancyState,
	createDefaultPregnancyState,
	PregnancyStatus
} from "@shared/domain/pregnancy/PregnancyState";
import { createDefaultBirthState } from "@shared/domain/birth/BirthState";
import { createDefaultWombState } from "@shared/domain/womb/WombState";
import { BirthPublisher } from "@client/components/network/BirthPublisher";
import { createDefaultLactationState } from "@shared/domain/lactation/LactationState";
import { BFActionBirth } from "@actions/BFBirth";
import { BFActionPregnancyStartAnimation } from "@actions/BFPregnancyStartAnimation";

jest.mock("@actions/BFBirth");
jest.mock("@actions/BFPregnancyStartAnimation");
jest.mock("@client/components/Moodles");
jest.mock("@client/components/Player");
jest.mock("@asledgehammer/pipewrench");

describe("Pregnancy", () => {
	const modData = {};
	const player = mock<IsoPlayer>({
		setMaxWeightBase: jest.fn(),
		getModData: jest.fn(() => modData)
	});
	const bind = (pregnancy: Pregnancy, boundPlayer: IsoPlayer): void =>
		(pregnancy as any).onCreatePlayer(boundPlayer);

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
				it(`should register ${event} listener during component construction`, () => {
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
					bind(pregnancy, mockPlayer);
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
					bind(pregnancy, mockPlayer);
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
					bind(pregnancy, mockPlayer);
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
					bind(pregnancy, mockPlayer);
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
					bind(pregnancy, mockPlayer);
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
					bind(pregnancy, mockPlayer);
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
					bind(pregnancy, mockPlayer);
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
					bind(pregnancy, mockPlayer);
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
					bind(pregnancy, mockPlayer);
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
					bind(pregnancy, mockPlayer);
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
				{ name: BFEventsEnum.PREGNANCY_START, index: 0 },
				{ name: BFEventsEnum.PREGNANCY_STOP, index: 1 },
				{ name: BFEventsEnum.PREGNANCY_LABOR, index: 2 }
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

			it("publishes a successful conception without directly mutating local state", () => {
				const addTrait = jest.spyOn(Player.prototype as any, "addTrait").mockClear();
				let latest: AuthoritativePregnancyState | undefined;
				const publishState = jest.fn((desired: AuthoritativePregnancyState) => {
					latest = desired;
				});
				const commands = {
					get latestDesiredState() {
						return latest;
					},
					publishState,
					setState: jest.fn(),
					onServerCommand: jest.fn()
				} as unknown as PregnancyPublisher;
				const snapshots = new SnapshotStore();
				const pregnancy = new Pregnancy(commands, snapshots);
				(pregnancy as any).onCreatePlayer(
					mock({
						getModData: jest.fn(() => ({}))
					})
				);
				snapshots.apply({
					schemaVersion: 1,
					stateVersion: 0,
					domains: {
						womb: createDefaultWombState(),
						lactation: createDefaultLactationState(),
						pregnancy: createDefaultPregnancyState(),
						birth: createDefaultBirthState()
					}
				});
				const [callback] = addListener.mock.calls[0];

				callback();
				callback();

				expect(publishState).toHaveBeenCalledTimes(1);
				expect(publishState).toHaveBeenCalledWith({
					...createDefaultPregnancyState(),
					status: PregnancyStatus.PREGNANT
				});
				expect(addTrait).not.toHaveBeenCalled();
			});

			it("plays start presentation once after the accepted status transition", () => {
				jest.restoreAllMocks();
				(SpyPipewrench.getGameTime as jest.Mock).mockReturnValue({
					getMinutesStamp: jest.fn().mockReturnValue(1)
				});
				const queue = jest.spyOn(ISTimedActionQueue, "add").mockClear();
				jest.spyOn(Player.prototype as any, "addTrait").mockImplementation(jest.fn());
				jest.spyOn(Player.prototype as any, "removeTrait").mockImplementation(jest.fn());
				const commands = {
					latestDesiredState: undefined,
					publishState: jest.fn(),
					setState: jest.fn(),
					onServerCommand: jest.fn()
				} as unknown as PregnancyPublisher;
				const snapshots = new SnapshotStore();
				const pregnancy = new Pregnancy(commands, snapshots);
				const store: Record<string, unknown> = {};
				bind(
					pregnancy,
					mock<IsoPlayer>({
						getModData: jest.fn(() => store)
					})
				);
				const notPregnant = createDefaultPregnancyState();
				const pregnant = { ...notPregnant, status: PregnancyStatus.PREGNANT };

				snapshots.apply({
					schemaVersion: 1,
					stateVersion: 1,
					domains: {
						pregnancy: notPregnant,
						birth: createDefaultBirthState(),
						womb: createDefaultWombState(),
						lactation: createDefaultLactationState()
					}
				});
				snapshots.apply({
					schemaVersion: 1,
					stateVersion: 2,
					domains: {
						pregnancy: pregnant,
						birth: createDefaultBirthState(),
						womb: createDefaultWombState(),
						lactation: createDefaultLactationState()
					}
				});
				snapshots.apply({
					schemaVersion: 1,
					stateVersion: 2,
					domains: {
						pregnancy: pregnant,
						birth: createDefaultBirthState(),
						womb: createDefaultWombState(),
						lactation: createDefaultLactationState()
					}
				});

				expect(queue).toHaveBeenCalledTimes(1);
			});
		});
	});

	// === PREGNANCY_UPDATE Event ===
	it("requests a server birth allocation after authoritative labor is acknowledged", () => {
		jest.spyOn(Player.prototype as any, "addTrait").mockImplementation(jest.fn());
		const snapshots = new SnapshotStore();
		const births = mock<BirthPublisher>({ allocate: jest.fn() });
		const pregnancy = new Pregnancy(undefined, snapshots, births);
		bind(
			pregnancy,
			mock<IsoPlayer>({
				getModData: jest.fn().mockReturnValue({})
			})
		);

		snapshots.apply({
			schemaVersion: 1,
			stateVersion: 2,
			domains: {
				womb: createDefaultWombState(),
				lactation: createDefaultLactationState(),
				pregnancy: {
					status: PregnancyStatus.PREGNANT,
					current: 100,
					progress: 1,
					isInLabor: true
				},
				birth: createDefaultBirthState()
			}
		});

		expect(births.allocate).toHaveBeenCalledTimes(1);
	});

	describe("authoritative birth presentation recovery", () => {
		const birthId = "mother:birth:1";
		const laborSnapshot = (stateVersion: number) => ({
			schemaVersion: 1,
			stateVersion,
			domains: {
				womb: createDefaultWombState(),
				lactation: createDefaultLactationState(),
				pregnancy: {
					status: PregnancyStatus.PREGNANT,
					current: 100,
					progress: 1,
					isInLabor: true
				},
				birth: { ...createDefaultBirthState(), pendingBirthId: birthId }
			}
		});

		it("releases movement on cancel and retries the same ID on the next minute", () => {
			jest.spyOn(Player.prototype as any, "addTrait").mockImplementation(jest.fn());
			const queue = jest.spyOn(ISTimedActionQueue, "add");
			const snapshots = new SnapshotStore();
			const pregnancy = new Pregnancy(undefined, snapshots, mock<BirthPublisher>());
			const setBlockMovement = jest.fn();
			bind(
				pregnancy,
				mock<IsoPlayer>({
					setBlockMovement,
					getModData: jest.fn(() => ({}))
				})
			);

			snapshots.apply(laborSnapshot(1));
			expect(BFActionBirth).toHaveBeenLastCalledWith(pregnancy, birthId);
			expect(queue).toHaveBeenCalledTimes(1);

			pregnancy.onBirthPresentationStopped(birthId);
			expect(setBlockMovement).toHaveBeenLastCalledWith(false);

			snapshots.apply(laborSnapshot(2));
			expect(queue).toHaveBeenCalledTimes(1);

			pregnancy.onEveryMinute();
			expect(queue).toHaveBeenCalledTimes(2);
			expect(BFActionBirth).toHaveBeenLastCalledWith(pregnancy, birthId);
			expect(setBlockMovement).toHaveBeenLastCalledWith(true);
		});

		it("submits completion once and does not requeue while awaiting acknowledgement", () => {
			jest.spyOn(Player.prototype as any, "addTrait").mockImplementation(jest.fn());
			const queue = jest.spyOn(ISTimedActionQueue, "add");
			const snapshots = new SnapshotStore();
			const births = mock<BirthPublisher>({ complete: jest.fn() });
			const pregnancy = new Pregnancy(undefined, snapshots, births);
			const setBlockMovement = jest.fn();
			bind(
				pregnancy,
				mock<IsoPlayer>({
					setBlockMovement,
					getModData: jest.fn(() => ({}))
				})
			);
			snapshots.apply(laborSnapshot(1));

			pregnancy.birth(birthId);
			pregnancy.birth(birthId);
			pregnancy.onEveryMinute();

			expect(births.complete).toHaveBeenCalledTimes(1);
			expect(births.complete).toHaveBeenCalledWith(birthId);
			expect(setBlockMovement).toHaveBeenLastCalledWith(false);
			expect(queue).toHaveBeenCalledTimes(1);
		});

		it("resubmits after a fresh session snapshot proves the birth is still pending", () => {
			jest.spyOn(Player.prototype as any, "addTrait").mockImplementation(jest.fn());
			const queue = jest.spyOn(ISTimedActionQueue, "add");
			const snapshots = new SnapshotStore();
			const births = mock<BirthPublisher>({ complete: jest.fn() });
			const pregnancy = new Pregnancy(undefined, snapshots, births);
			bind(
				pregnancy,
				mock<IsoPlayer>({
					setBlockMovement: jest.fn(),
					getModData: jest.fn(() => ({}))
				})
			);
			snapshots.apply(laborSnapshot(1));
			pregnancy.birth(birthId);
			snapshots.resetSession();

			snapshots.apply(laborSnapshot(1));

			expect(births.complete).toHaveBeenCalledTimes(2);
			expect(births.complete).toHaveBeenLastCalledWith(birthId);
			expect(queue).toHaveBeenCalledTimes(1);
		});

		it("ignores a stale action whose ID does not match the current pending birth", () => {
			jest.spyOn(Player.prototype as any, "addTrait").mockImplementation(jest.fn());
			const snapshots = new SnapshotStore();
			const births = mock<BirthPublisher>({ complete: jest.fn() });
			const pregnancy = new Pregnancy(undefined, snapshots, births);
			const setBlockMovement = jest.fn();
			bind(
				pregnancy,
				mock<IsoPlayer>({
					setBlockMovement,
					getModData: jest.fn(() => ({}))
				})
			);
			snapshots.apply(laborSnapshot(1));
			setBlockMovement.mockClear();

			pregnancy.birth("mother:birth:older");

			expect(births.complete).not.toHaveBeenCalled();
			expect(setBlockMovement).not.toHaveBeenCalled();
		});

		it("ignores late completion after the active presentation was canceled", () => {
			jest.spyOn(Player.prototype as any, "addTrait").mockImplementation(jest.fn());
			const snapshots = new SnapshotStore();
			const births = mock<BirthPublisher>({ complete: jest.fn() });
			const pregnancy = new Pregnancy(undefined, snapshots, births);
			const setBlockMovement = jest.fn();
			bind(
				pregnancy,
				mock<IsoPlayer>({
					setBlockMovement,
					getModData: jest.fn(() => ({}))
				})
			);
			snapshots.apply(laborSnapshot(1));
			pregnancy.onBirthPresentationStopped(birthId);
			setBlockMovement.mockClear();

			pregnancy.birth(birthId);

			expect(births.complete).not.toHaveBeenCalled();
			expect(setBlockMovement).not.toHaveBeenCalled();
		});

		it("ignores a stop callback from an action other than the active birth", () => {
			jest.spyOn(Player.prototype as any, "addTrait").mockImplementation(jest.fn());
			const snapshots = new SnapshotStore();
			const pregnancy = new Pregnancy(undefined, snapshots, mock<BirthPublisher>());
			const setBlockMovement = jest.fn();
			bind(
				pregnancy,
				mock<IsoPlayer>({
					setBlockMovement,
					getModData: jest.fn(() => ({}))
				})
			);
			snapshots.apply(laborSnapshot(1));
			setBlockMovement.mockClear();

			pregnancy.onBirthPresentationStopped("mother:birth:older");

			expect(setBlockMovement).not.toHaveBeenCalled();
			pregnancy.onEveryMinute();
			expect(ISTimedActionQueue.add).toHaveBeenCalledTimes(1);
		});

		it("queues a retained pending birth after player recreation", () => {
			jest.spyOn(Player.prototype as any, "addTrait").mockImplementation(jest.fn());
			const queue = jest.spyOn(ISTimedActionQueue, "add");
			const snapshots = new SnapshotStore();
			snapshots.apply(laborSnapshot(1));
			const pregnancy = new Pregnancy(undefined, snapshots, mock<BirthPublisher>());
			(pregnancy as any).onCreatePlayer(
				mock<IsoPlayer>({
					setBlockMovement: jest.fn(),
					getModData: jest.fn(() => ({}))
				})
			);

			expect(queue).toHaveBeenCalledTimes(1);
			expect(BFActionBirth).toHaveBeenLastCalledWith(pregnancy, birthId);
		});

		it("terminates only the dead bound player and waits for a fresh snapshot after recreation", () => {
			jest.spyOn(Player.prototype as any, "addTrait").mockImplementation(jest.fn());
			const queue = jest.spyOn(ISTimedActionQueue, "add");
			const deathListeners: Array<(player: IsoPlayer) => void> = [];
			(Events.onPlayerDeath.addListener as jest.Mock).mockImplementation(listener => {
				deathListeners.push(listener);
			});
			const snapshots = new SnapshotStore();
			const births = mock<BirthPublisher>({ allocate: jest.fn(), complete: jest.fn() });
			const pregnancy = new Pregnancy(undefined, snapshots, births);
			const setDeadMovement = jest.fn();
			const deadPlayer = mock<IsoPlayer>({
				setBlockMovement: setDeadMovement,
				getModData: jest.fn(() => ({}))
			});
			const otherPlayer = mock<IsoPlayer>();

			(pregnancy as any).onCreatePlayer(deadPlayer);
			snapshots.apply(laborSnapshot(1));
			expect(queue).toHaveBeenCalledTimes(1);

			deathListeners[0](otherPlayer);
			pregnancy.onEveryMinute();
			expect(queue).toHaveBeenCalledTimes(1);

			deathListeners[0](deadPlayer);
			expect(setDeadMovement).toHaveBeenLastCalledWith(false);
			expect(births.resetSession).toHaveBeenCalledTimes(1);
			snapshots.apply(laborSnapshot(2));
			pregnancy.onEveryMinute();
			expect(queue).toHaveBeenCalledTimes(1);
			expect(births.allocate).not.toHaveBeenCalled();
			expect(births.complete).not.toHaveBeenCalled();

			const replacement = mock<IsoPlayer>({
				setBlockMovement: jest.fn(),
				getModData: jest.fn(() => ({}))
			});
			(pregnancy as any).onCreatePlayer(replacement);
			expect(snapshots.snapshot).toBeUndefined();
			expect(queue).toHaveBeenCalledTimes(1);

			snapshots.apply(laborSnapshot(1));
			expect(queue).toHaveBeenCalledTimes(2);
			expect(BFActionBirth).toHaveBeenLastCalledWith(pregnancy, birthId);
		});

		it("does not resubmit a completion after the bound player dies", () => {
			jest.spyOn(Player.prototype as any, "addTrait").mockImplementation(jest.fn());
			let deathListener: ((player: IsoPlayer) => void) | undefined;
			(Events.onPlayerDeath.addListener as jest.Mock).mockImplementation(listener => {
				deathListener = listener;
			});
			const snapshots = new SnapshotStore();
			const births = mock<BirthPublisher>({ complete: jest.fn() });
			const pregnancy = new Pregnancy(undefined, snapshots, births);
			const player = mock<IsoPlayer>({
				setBlockMovement: jest.fn(),
				getModData: jest.fn(() => ({}))
			});
			(pregnancy as any).onCreatePlayer(player);
			snapshots.apply(laborSnapshot(1));
			pregnancy.birth(birthId);
			expect(births.complete).toHaveBeenCalledTimes(1);

			deathListener!(player);
			expect(births.resetSession).toHaveBeenCalledTimes(1);
			snapshots.apply(laborSnapshot(2));
			pregnancy.onEveryMinute();
			pregnancy.birth(birthId);

			expect(births.complete).toHaveBeenCalledTimes(1);
		});

		it("installs one lifecycle listener set and routes it to the replacement binding", () => {
			const minuteListeners: Array<() => void> = [];
			const hourListeners: Array<() => void> = [];
			const dayListeners: Array<() => void> = [];
			const deathListeners: Array<(player: IsoPlayer) => void> = [];
			(Events.everyOneMinute.addListener as jest.Mock).mockImplementation(listener =>
				minuteListeners.push(listener)
			);
			(Events.everyHours.addListener as jest.Mock).mockImplementation(listener =>
				hourListeners.push(listener)
			);
			(Events.everyDays.addListener as jest.Mock).mockImplementation(listener =>
				dayListeners.push(listener)
			);
			(Events.onPlayerDeath.addListener as jest.Mock).mockImplementation(listener =>
				deathListeners.push(listener)
			);
			const custom = new Map<string, Array<(...args: any[]) => void>>();
			(Events.EventEmitter as jest.Mock).mockImplementation((name: string) => ({
				addListener: (listener: (...args: any[]) => void) => {
					const listeners = custom.get(name) ?? [];
					listeners.push(listener);
					custom.set(name, listeners);
				}
			}));
			const pregnancy = new Pregnancy();
			const first = mock<IsoPlayer>({ getModData: jest.fn(() => ({})) });
			const replacement = mock<IsoPlayer>({
				setBlockMovement: jest.fn(),
				getModData: jest.fn(() => ({}))
			});
			const minute = jest.spyOn(pregnancy, "onEveryMinute").mockImplementation(jest.fn());
			const hour = jest.spyOn(pregnancy, "onEveryHour").mockImplementation(jest.fn());
			const day = jest.spyOn(pregnancy, "onEveryDay").mockImplementation(jest.fn());
			const start = jest.spyOn(pregnancy as any, "start").mockImplementation(jest.fn());
			const stop = jest.spyOn(pregnancy as any, "stop").mockImplementation(jest.fn());
			const labor = jest.spyOn(pregnancy as any, "onLabor").mockImplementation(jest.fn());

			(pregnancy as any).onCreatePlayer(first);
			(pregnancy as any).onCreatePlayer(replacement);

			expect(minuteListeners).toHaveLength(1);
			expect(hourListeners).toHaveLength(1);
			expect(dayListeners).toHaveLength(1);
			expect(deathListeners).toHaveLength(1);
			expect(custom.get(BFEventsEnum.PREGNANCY_START)).toHaveLength(1);
			expect(custom.get(BFEventsEnum.PREGNANCY_STOP)).toHaveLength(1);
			expect(custom.get(BFEventsEnum.PREGNANCY_LABOR)).toHaveLength(1);

			minuteListeners[0]();
			hourListeners[0]();
			dayListeners[0]();
			custom.get(BFEventsEnum.PREGNANCY_START)![0]();
			custom.get(BFEventsEnum.PREGNANCY_STOP)![0]();
			custom.get(BFEventsEnum.PREGNANCY_LABOR)![0](2);
			deathListeners[0](first);
			expect(replacement.setBlockMovement).not.toHaveBeenCalled();
			deathListeners[0](replacement);

			expect(minute).toHaveBeenCalledTimes(1);
			expect(hour).toHaveBeenCalledTimes(1);
			expect(day).toHaveBeenCalledTimes(1);
			expect(start).toHaveBeenCalledTimes(1);
			expect(stop).toHaveBeenCalledTimes(1);
			expect(labor).toHaveBeenCalledTimes(1);
			expect(replacement.setBlockMovement).toHaveBeenCalledWith(false);
		});

		it("suppresses non-birth Pregnancy effects and debug mutations after death", () => {
			let deathListener: ((player: IsoPlayer) => void) | undefined;
			(Events.onPlayerDeath.addListener as jest.Mock).mockImplementation(listener => {
				deathListener = listener;
			});
			const commands = mock<PregnancyPublisher>();
			const pregnancy = new Pregnancy(commands);
			const AddItem = jest.fn();
			const player = mock<IsoPlayer>({
				setBlockMovement: jest.fn(),
				getInventory: jest.fn().mockReturnValue({ AddItem }),
				getModData: jest.fn(() => ({}))
			});
			const bodyEffect = jest
				.spyOn(pregnancy as any, "applyBodyEffect")
				.mockImplementation(jest.fn());
			(pregnancy as any).onCreatePlayer(player);
			deathListener!(player);

			pregnancy.onEveryHour();
			pregnancy.onEveryDay();
			(pregnancy as any).onLabor(1);
			pregnancy.Debug.start();
			pregnancy.Debug.stop();
			pregnancy.Debug.advance(10);
			pregnancy.Debug.advanceToLabor();
			pregnancy.birth();

			expect(bodyEffect).not.toHaveBeenCalled();
			expect(commands.setState).not.toHaveBeenCalled();
			expect(commands.publishState).not.toHaveBeenCalled();
			expect(AddItem).not.toHaveBeenCalled();
		});

		it("does not inherit conception transition history after replacement binding", () => {
			let deathListener: ((player: IsoPlayer) => void) | undefined;
			(Events.onPlayerDeath.addListener as jest.Mock).mockImplementation(listener => {
				deathListener = listener;
			});
			jest.spyOn(Player.prototype as any, "addTrait").mockImplementation(jest.fn());
			jest.spyOn(Player.prototype as any, "removeTrait").mockImplementation(jest.fn());
			const snapshots = new SnapshotStore();
			const pregnancy = new Pregnancy(undefined, snapshots, mock<BirthPublisher>());
			const playStart = jest
				.spyOn(pregnancy as any, "playStartAnimation")
				.mockImplementation(jest.fn());
			const first = mock<IsoPlayer>({
				setBlockMovement: jest.fn(),
				getModData: jest.fn(() => ({}))
			});
			(pregnancy as any).onCreatePlayer(first);
			snapshots.apply({
				...laborSnapshot(1),
				domains: {
					...laborSnapshot(1).domains,
					pregnancy: createDefaultPregnancyState(),
					birth: createDefaultBirthState()
				}
			});
			deathListener!(first);

			const replacement = mock<IsoPlayer>({
				setBlockMovement: jest.fn(),
				getModData: jest.fn(() => ({}))
			});
			(pregnancy as any).onCreatePlayer(replacement);
			snapshots.apply(laborSnapshot(1));

			expect(playStart).not.toHaveBeenCalled();
		});

		it("retries an interrupted legacy birth on the next minute", () => {
			const queue = jest.spyOn(ISTimedActionQueue, "add");
			const pregnancy = new Pregnancy();
			const setBlockMovement = jest.fn();
			const legacyModData = {};
			bind(
				pregnancy,
				mock<IsoPlayer>({
					setBlockMovement,
					getModData: jest.fn(() => legacyModData)
				})
			);
			let presentation = {
				current: 99,
				progress: 0.99,
				isInLabor: false
			};
			const pregnancyState = jest
				.spyOn(PregnancyState, "get")
				.mockImplementation(() => presentation);
			const duration = jest.spyOn(PregnancyOptions, "duration", "get").mockReturnValue(100);
			try {
				pregnancy.onEveryMinute();
				expect(queue).toHaveBeenCalledTimes(1);
				pregnancy.onBirthPresentationStopped();
				expect(setBlockMovement).toHaveBeenLastCalledWith(false);

				presentation = { current: 100, progress: 1, isInLabor: true };
				pregnancy.onEveryMinute();
				expect(queue).toHaveBeenCalledTimes(2);
				expect(BFActionBirth).toHaveBeenLastCalledWith(pregnancy);
				expect(setBlockMovement).toHaveBeenLastCalledWith(true);
			} finally {
				pregnancyState.mockRestore();
				duration.mockRestore();
			}
		});
	});

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
				call => call[0] === "BFPregnancyUpdate"
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
			expect(removeTrait).toHaveBeenCalledWith(BFTraitsEnum.PREGNANCY);
			expect(AddItem).toHaveBeenCalledWith(ITEMS.BABY);
		});
	});

	// === Debug Functions ===
	describe("Debug", () => {
		it("starts and stops Pregnancy locally when command synchronization is unavailable", () => {
			const addTrait = jest
				.spyOn(Player.prototype as any, "addTrait")
				.mockImplementation(jest.fn());
			const removeTrait = jest
				.spyOn(Player.prototype as any, "removeTrait")
				.mockImplementation(jest.fn());
			const queue = jest.spyOn(ISTimedActionQueue, "add");
			const localPlayer = mock<IsoPlayer>({ getModData: jest.fn(() => ({})) });
			const pregnancy = new Pregnancy();
			bind(pregnancy, localPlayer);

			pregnancy.Debug.start();

			expect(addTrait).toHaveBeenCalledWith(BFTraitsEnum.PREGNANCY);
			expect(queue).toHaveBeenCalledWith(expect.any(BFActionPregnancyStartAnimation));

			pregnancy.Debug.stop();

			expect(removeTrait).toHaveBeenCalledWith(BFTraitsEnum.PREGNANCY);
		});

		it("advances Pregnancy locally when command synchronization is unavailable", () => {
			const localPlayer = mock<IsoPlayer>({ getModData: jest.fn(() => ({})) });
			const pregnancy = new Pregnancy();
			bind(pregnancy, localPlayer);
			jest.spyOn(PregnancyOptions, "duration", "get").mockReturnValue(100);
			jest.spyOn(PregnancyState, "get").mockReturnValue({
				current: 10,
				progress: 0.1,
				isInLabor: false
			});
			const set = jest.spyOn(PregnancyState, "set");

			pregnancy.Debug.advance(20);

			expect(set).toHaveBeenCalledWith(localPlayer, {
				current: 30,
				progress: 0.3,
				isInLabor: false
			});
			expect(SpyPipewrench.triggerEvent).toHaveBeenCalled();
			const eventCalls = (SpyPipewrench.triggerEvent as jest.Mock).mock.calls;
			expect(eventCalls.slice(-2).map(call => call[0])).toEqual([
				BFEventsEnum.PREGNANCY_UPDATE,
				["ZL", "BFPregnancyUpdate"].join("")
			]);
		});

		it("queues local birth presentation when a debug advance reaches labor", () => {
			const localPlayer = mock<IsoPlayer>({
				getModData: jest.fn(() => ({})),
				setBlockMovement: jest.fn()
			});
			const pregnancy = new Pregnancy();
			bind(pregnancy, localPlayer);
			jest.spyOn(PregnancyOptions, "duration", "get").mockReturnValue(100);
			jest.spyOn(PregnancyState, "get").mockReturnValue({
				current: 90,
				progress: 0.9,
				isInLabor: false
			});
			const queue = jest.spyOn(ISTimedActionQueue, "add");

			pregnancy.Debug.advance(10);

			expect(queue).toHaveBeenCalledWith(expect.any(BFActionBirth));
		});

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
			bind(
				pregnancy,
				mock<IsoPlayer>({
					getModData: jest.fn(() => store)
				})
			);
			(pregnancy as any).lastMinuteStamp = 10;
			snapshots.apply({
				schemaVersion: 1,
				stateVersion: 1,
				domains: {
					womb: createDefaultWombState(),
					lactation: createDefaultLactationState(),
					birth: createDefaultBirthState(),
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

		it("does not republish a pregnancy that is already at full labor", () => {
			jest.restoreAllMocks();
			(SpyPipewrench.getGameTime as jest.Mock).mockReturnValue({
				getMinutesStamp: jest.fn().mockReturnValue(11)
			});
			jest.spyOn(PregnancyOptions, "duration", "get").mockReturnValue(10);
			jest.spyOn(Player.prototype as any, "addTrait").mockImplementation(jest.fn());
			const commands = mock<PregnancyPublisher>({
				publishState: jest.fn(),
				latestDesiredState: undefined
			});
			const snapshots = new SnapshotStore();
			const pregnancy = new Pregnancy(commands, snapshots);
			bind(
				pregnancy,
				mock<IsoPlayer>({
					getModData: jest.fn(() => ({}))
				})
			);
			(pregnancy as any).lastMinuteStamp = 10;
			snapshots.apply({
				schemaVersion: 1,
				stateVersion: 2,
				domains: {
					womb: createDefaultWombState(),
					lactation: createDefaultLactationState(),
					birth: createDefaultBirthState(),
					pregnancy: {
						status: PregnancyStatus.PREGNANT,
						current: 10,
						progress: 1,
						isInLabor: true
					}
				}
			});
			pregnancy.onEveryMinute();

			expect(commands.publishState).not.toHaveBeenCalled();
		});

		it("keeps authoritative Pregnancy present when multiplayer removes the local trait", () => {
			jest.restoreAllMocks();
			const snapshots = new SnapshotStore();
			const pregnancy = new Pregnancy(undefined, snapshots);
			const store: Record<string, unknown> = {};
			const localPlayer = mock<IsoPlayer>({ getModData: jest.fn(() => store) });
			bind(pregnancy, localPlayer);
			const data = { current: 12, progress: 0.25, isInLabor: false };
			jest.spyOn(PregnancyState, "get").mockReturnValue(null);
			snapshots.apply({
				schemaVersion: 1,
				stateVersion: 1,
				domains: {
					womb: createDefaultWombState(),
					lactation: createDefaultLactationState(),
					birth: createDefaultBirthState(),
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
			bind(
				pregnancy,
				mock<IsoPlayer>({
					getModData: jest.fn(() => store)
				})
			);

			snapshots.apply({
				schemaVersion: 1,
				stateVersion: 2,
				domains: {
					womb: createDefaultWombState(),
					lactation: createDefaultLactationState(),
					birth: createDefaultBirthState(),
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
			bind(pregnancy, mock<IsoPlayer>({ getModData: jest.fn(() => ({})) }));

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
			bind(pregnancy, mock<IsoPlayer>({ getModData: jest.fn(() => ({})) }));
			jest.spyOn(PregnancyOptions, "duration", "get").mockReturnValue(14 * 24 * 60);
			snapshots.apply({
				schemaVersion: 1,
				stateVersion: 1,
				domains: {
					womb: createDefaultWombState(),
					lactation: createDefaultLactationState(),
					birth: createDefaultBirthState(),
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
