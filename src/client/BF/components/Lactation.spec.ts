/* eslint-disable @typescript-eslint/no-explicit-any */
import { Lactation } from "@client/components/Lactation";
import * as SpyPipewrench from "@asledgehammer/pipewrench";
import * as Events from "@asledgehammer/pipewrench-events";
import * as SpyModData from "@client/components/ModData";
import { LactationData } from "@types";
import { BFEventsEnum } from "@constants";
import { Player } from "@client/components/Player";
import { mockedPlayer } from "@test/mock";
import { PregnancyState } from "@client/components/PregnancyState";
import { LactationPublisher } from "@client/components/network/LactationPublisher";
import { SnapshotStore } from "@client/components/network/SnapshotStore";
import {
	BF_NETWORK_MODULE,
	BF_PROTOCOL_SCHEMA_VERSION,
	BFNetworkCommand,
	BFSyncStatus
} from "@constants";
import { createDefaultDomains } from "@shared/BFState";

jest.mock("@asledgehammer/pipewrench-events");
jest.mock("@client/components/Moodles");
jest.mock("@client/components/Player");
jest.mock("@client/components/PregnancyState");

const SpyHasTrait = jest.fn().mockReturnValue(false);

describe("Lactation", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.resetModules();
		SpyHasTrait.mockReset().mockReturnValue(false);
		(PregnancyState.get as jest.Mock).mockReturnValue(null);
	});

	describe("Without player or data", () => {
		it("returns static bottleAmount and percentage", () => {
			const lactation = new Lactation();
			expect(lactation.bottleAmount).toBe(0.2);
			expect(lactation.percentage).toBe(0);
		});

		it("isLactating and milk amount are false/0", () => {
			const lactation = new Lactation();
			expect(lactation.isLactating).toBe(false);
			expect(lactation.milkAmount).toBe(0);
		});

		it("useMilk does not invoke HasTrait", () => {
			const lactation = new Lactation();
			lactation.useMilk(100);
			expect(SpyHasTrait).not.toHaveBeenCalled();
		});
	});

	describe("When player & data are defined", () => {
		beforeEach(() => {
			jest.spyOn(Player.prototype, "data", "get").mockReturnValue({
				isActive: true,
				milkAmount: 0.4,
				expiration: 8,
				multiplier: 0
			});
		});

		it("should initialize correctly and use traits", () => {
			const lactation = new Lactation();
			lactation.onCreatePlayer(mockedPlayer());
			expect(lactation.isLactating).toBe(true);
			expect(lactation.milkAmount).toBe(0.4);
		});

		it("useMilk updates milkAmount and checks trait", () => {
			const lactation = new Lactation();
			lactation.onCreatePlayer(
				mockedPlayer({
					HasTrait: SpyHasTrait.mockImplementation(() => true)
				})
			);
			lactation.useMilk(0.1);
			expect(SpyHasTrait).toHaveBeenCalledWith("bf:dairycow");
			expect(lactation.milkAmount).toBeCloseTo(0.3);
		});

		it("publishes complete state after milk use", () => {
			const commands = { publishState: jest.fn() } as unknown as LactationPublisher;
			const lactation = new Lactation(new SnapshotStore(), commands);
			lactation.onCreatePlayer(mockedPlayer());
			lactation.useMilk(0.1, 0.2);
			const published = jest.mocked(commands.publishState).mock.calls[0][0];
			expect(published).toEqual(expect.objectContaining({ isActive: true, multiplier: 0.2 }));
			expect(published.milkAmount).toBeCloseTo(0.3);
		});

		it("publishes only the final compound Pregnancy activation state", () => {
			const commands = { publishState: jest.fn() } as unknown as LactationPublisher;
			const lactation = new Lactation(new SnapshotStore(), commands);
			lactation.onCreatePlayer(mockedPlayer());
			(PregnancyState.get as jest.Mock).mockReturnValue({ progress: 0.6, current: 1 });
			lactation.onPregnancyUpdate({ progress: 0.6, current: 1 });
			expect(commands.publishState).toHaveBeenCalledTimes(1);
			expect(commands.publishState).toHaveBeenCalledWith(
				expect.objectContaining({ isActive: true, multiplier: 0.6 }),
				expect.objectContaining({
					isActive: { mode: "replace", value: true },
					multiplier: { mode: "replace", value: 0.6 }
				})
			);
		});

		it("drains equal-version optimism back to the retained recipe snapshot", () => {
			const snapshots = new SnapshotStore();
			const publisher = new LactationPublisher(snapshots);
			const assigned: LactationData[] = [];
			jest.spyOn(Player.prototype, "data", "set").mockImplementation(value =>
				assigned.push(value)
			);
			new Lactation(snapshots, publisher);
			const desired = { isActive: true, milkAmount: 0.6, expiration: 8, multiplier: 0 };
			const authoritative = { ...desired, milkAmount: 0.3 };
			publisher.publishState(desired, {});
			const snapshot = {
				schemaVersion: 1,
				stateVersion: 2,
				domains: { ...createDefaultDomains(), lactation: authoritative }
			};
			snapshots.apply(snapshot);
			publisher.onServerCommand(
				BF_NETWORK_MODULE,
				BFNetworkCommand.PUBLISH_LACTATION_STATE_RESPONSE,
				{
					schemaVersion: BF_PROTOCOL_SCHEMA_VERSION,
					requestId: "lactation-1",
					revision: 1,
					status: BFSyncStatus.OK,
					data: { snapshot }
				}
			);
			expect(assigned[assigned.length - 1]).toEqual(authoritative);
		});

		describe("Timer events", () => {
			const data: LactationData = {
				isActive: true,
				milkAmount: 0.4,
				expiration: 1,
				multiplier: 0
			};
			beforeEach(() => {
				jest.spyOn(SpyModData.ModData.prototype, "data", "get").mockReturnValue(data);
			});

			describe("everyOneMinute event", () => {
				it("should trigger LACTATION_UPDATE with current data", () => {
					const lactation = new Lactation();
					lactation.onCreatePlayer(mockedPlayer());
					lactation.onEveryMinute();
					expect(SpyPipewrench.triggerEvent).toHaveBeenCalledWith(
						BFEventsEnum.LACTATION_UPDATE,
						expect.objectContaining({
							isActive: true,
							milkAmount: 0.4,
							multiplier: 0
						})
					);
				});
			});
			describe("everyTenMinutes", () => {
				it("Should inflict body effects from engorgement", () => {
					const lactation = new Lactation();
					const spyBodyEffect = jest.spyOn(lactation as any, "applyBodyEffect");
					lactation.onCreatePlayer(mockedPlayer());
					lactation.onEveryTenMinutes();
					expect(spyBodyEffect).toHaveBeenCalled();
				});
			});
			describe("everyHour event", () => {
				beforeEach(() => {
					jest.spyOn(Player.prototype, "data", "get")
						.mockReturnValueOnce(data)
						.mockReturnValue({ ...data, expiration: 0 });
				});
				it("Should call moodle", () => {
					const moodle = jest.fn();
					const lactation = new Lactation();
					lactation.onCreatePlayer(mockedPlayer());
					(lactation as any).moodle = { moodle };
					lactation.onEveryHour();
					expect(moodle).toHaveBeenCalled();
				});
				it("Should de-activate lactation when it expires", () => {
					const lactation = new Lactation();
					lactation.onCreatePlayer(mockedPlayer());
					expect(lactation.isLactating).toBe(true);
					lactation.onEveryHour();
					expect(lactation.isLactating).toBe(false);
				});
			});
		});

		describe("Lactation update event", () => {
			it("should register PREGNANCY_UPDATE listener and call onPregnancyUpdate", () => {
				const addListener = jest.fn();
				jest.spyOn(Events, "EventEmitter").mockImplementation(
					() => ({ addListener }) as any
				);

				const lactation = new Lactation();
				const onPregnancyUpdateSpy = jest.spyOn(lactation, "onPregnancyUpdate");
				lactation.onCreatePlayer(mockedPlayer());

				expect(Events.EventEmitter).toHaveBeenCalledWith(BFEventsEnum.PREGNANCY_UPDATE);
				expect(addListener).toHaveBeenCalledWith(expect.any(Function));

				const payload = { progress: 0.8 };
				const [callback] = addListener.mock.calls[0];
				callback(payload);

				expect(onPregnancyUpdateSpy).toHaveBeenCalledWith(payload);
			});

			it("should register LACTATION_UPDATE listener and call onLactationUpdate", () => {
				const addListener = jest.fn();
				jest.spyOn(Events, "EventEmitter").mockImplementation(
					() => ({ addListener }) as any
				);

				const lactation = new Lactation();
				const onLactationUpdateSpy = jest.spyOn(lactation, "onLactationUpdate");
				lactation.onCreatePlayer(mockedPlayer());

				expect(Events.EventEmitter).toHaveBeenCalledWith(BFEventsEnum.LACTATION_UPDATE);
				expect(addListener).toHaveBeenCalledWith(expect.any(Function));

				const payload: LactationData = {
					isActive: true,
					milkAmount: 0.4,
					expiration: 8,
					multiplier: 0
				};
				const [callback] = addListener.mock.calls[1];
				callback(payload);

				expect(onLactationUpdateSpy).toHaveBeenCalledWith(payload);
			});

			it("onLactationUpdate should increase milk amount while lactating", () => {
				jest.spyOn(SpyPipewrench, "ZombRandFloat").mockReturnValue(0.005);
				jest.spyOn(Player.prototype, "data", "get").mockReturnValue({
					isActive: true,
					milkAmount: 0.4,
					expiration: 8,
					multiplier: 0
				});

				const lactation = new Lactation();
				lactation.onCreatePlayer(mockedPlayer());
				lactation.onLactationUpdate({
					isActive: true,
					milkAmount: 0.4,
					expiration: 8,
					multiplier: 0
				});

				expect(lactation.milkAmount).toBeGreaterThan(0.4);
			});

			it("publishes only the actual near-capacity production delta", () => {
				jest.spyOn(SpyPipewrench, "ZombRandFloat").mockReturnValue(0.01);
				jest.spyOn(Player.prototype, "data", "get").mockReturnValue({
					isActive: true,
					milkAmount: 0.999,
					expiration: 8,
					multiplier: 0
				});
				const commands = { publishState: jest.fn() } as unknown as LactationPublisher;
				const lactation = new Lactation(new SnapshotStore(), commands);
				lactation.onCreatePlayer(mockedPlayer());
				lactation.onLactationUpdate(lactation.data!);
				const intent = jest.mocked(commands.publishState).mock.calls[0][1]!;
				expect(intent.milkAmount?.value).toBeCloseTo(0.001);
			});

			it("does not publish production while already at capacity", () => {
				jest.spyOn(Player.prototype, "data", "get").mockReturnValue({
					isActive: true,
					milkAmount: 1,
					expiration: 8,
					multiplier: 0
				});
				const commands = { publishState: jest.fn() } as unknown as LactationPublisher;
				const lactation = new Lactation(new SnapshotStore(), commands);
				lactation.onCreatePlayer(mockedPlayer());
				lactation.onLactationUpdate(lactation.data!);
				expect(commands.publishState).not.toHaveBeenCalled();
			});
		});

		describe("Debug functions", () => {
			it.each<{ operation: "add" | "remove" | "set"; expected: number }>([
				{ operation: "add", expected: 0.5 },
				{ operation: "remove", expected: 0.3 },
				{ operation: "set", expected: 0.1 }
			])("should $operation milk", ({ operation, expected }) => {
				const lactation = new Lactation();
				lactation.onCreatePlayer(mockedPlayer());
				lactation.Debug.set(0.4);
				lactation.Debug[operation](0.1);
				expect(lactation.milkAmount).toBeCloseTo(expected);
			});

			it("should be able to toggle lactation and call moodle with 0", () => {
				const moodle = jest.fn();
				const lactation = new Lactation();
				lactation.onCreatePlayer(mockedPlayer());
				(lactation as any).moodle = { moodle };
				expect(lactation.isLactating).toBe(true);
				moodle.mockClear();
				lactation.Debug.toggle(false);
				expect(lactation.isLactating).toBe(false);
				expect(moodle).toHaveBeenCalledWith(0);
			});
		});
	});

	describe("when not lactating", () => {
		beforeEach(() => {
			const data: LactationData = {
				isActive: false,
				milkAmount: 0,
				expiration: 1,
				multiplier: 0
			};
			jest.spyOn(Player.prototype, "data", "get").mockReturnValue(data);
		});
		it.each([{ handler: "onEveryTenMinutes" }, { handler: "onEveryHour" }])(
			"$fn should do nothing when not lactating",
			({ handler }) => {
				const lactation = new Lactation();
				(lactation as any)[handler]();
				expect(lactation.milkAmount).toBe(0);
			}
		);

		it("onLactationUpdate should do nothing when not lactating", () => {
			const lactation = new Lactation();
			lactation.onLactationUpdate({
				isActive: false,
				milkAmount: 0,
				expiration: 1,
				multiplier: 0
			});
			expect(lactation.milkAmount).toBe(0);
		});
	});

	describe("Timer Events", () => {
		describe.each([
			{ event: "everyOneMinute", handler: "onEveryMinute" },
			{ event: "everyTenMinutes", handler: "onEveryTenMinutes" },
			{ event: "everyHours", handler: "onEveryHour" }
		])("For $event", ({ event, handler }) => {
			const mockEventListener = jest.fn();
			let lactation: Lactation;
			beforeEach(() => {
				mockEventListener.mockClear();
				(Events as any)[event] = {
					addListener: mockEventListener
				};
				const player = mockedPlayer();
				lactation = new Lactation();
				lactation.onCreatePlayer(player);
			});
			it(`should register ${event} listener during player creation`, () => {
				expect(mockEventListener).toHaveBeenCalledWith(expect.any(Function));
			});
			it(`should call ${event} method when event fires`, () => {
				const spy = jest.spyOn(lactation as any, handler);
				const [callback] = mockEventListener.mock.calls[0];
				callback();
				expect(spy).toHaveBeenCalled();
			});
		});
	});

	describe("Pregnancy events", () => {
		it.each([
			{ progress: null, expected: false },
			{ progress: 0.4, expected: false },
			{ progress: 0.8, expected: true }
		])(
			"Lactation should be $expected when pregnancy progress is: $progress",
			({ progress, expected }) => {
				(PregnancyState.get as jest.Mock).mockReturnValue(progress ? { progress } : null);
				jest.spyOn(Player.prototype, "data", "get").mockReturnValue({
					isActive: false,
					milkAmount: 0,
					expiration: 0,
					multiplier: 0
				});

				const lactation = new Lactation();
				lactation.onCreatePlayer(
					mockedPlayer({ HasTrait: SpyHasTrait.mockImplementation(() => true) })
				);
				lactation.onPregnancyUpdate({ progress: progress ?? 0, current: 0 });
				expect(lactation.isLactating).toBe(expected);
			}
		);
	});

	describe("Image resolution", () => {
		it.each([
			{
				state: "non pregnant",
				fullness: "empty",
				progress: null,
				amount: 0.3,
				expected: "normal_empty.png"
			},
			{
				state: "non pregnant",
				fullness: "full",
				progress: null,
				amount: 0.9,
				expected: "normal_full.png"
			},
			{
				state: "too early in pregnancy",
				fullness: "empty",
				progress: 0,
				amount: 0.3,
				expected: "normal_empty.png"
			},
			{
				state: "too early in pregnancy",
				fullness: "full",
				progress: 0,
				amount: 0.9,
				expected: "normal_full.png"
			},
			{
				state: "pregnancy early",
				fullness: "empty",
				progress: 0.5,
				amount: 0.3,
				expected: "pregnant_early_empty.png"
			},
			{
				state: "pregnancy early",
				fullness: "full",
				progress: 0.5,
				amount: 0.9,
				expected: "pregnant_early_full.png"
			},
			{
				state: "pregnancy late",
				fullness: "empty",
				progress: 0.9,
				amount: 0.3,
				expected: "pregnant_late_empty.png"
			},
			{
				state: "pregnancy late",
				fullness: "full",
				progress: 0.9,
				amount: 0.9,
				expected: "pregnant_late_full.png"
			}
		])(
			"returns correct image when state is $state and fullness is $fullness",
			({ progress, amount, expected }) => {
				(PregnancyState.get as jest.Mock).mockReturnValue(progress ? { progress } : null);
				jest.spyOn(Player.prototype, "data", "get").mockReturnValue({
					isActive: true,
					milkAmount: amount,
					expiration: 8,
					multiplier: 1
				});

				const lactation = new Lactation();
				lactation.onCreatePlayer(
					mockedPlayer({ HasTrait: SpyHasTrait.mockImplementation(() => true) })
				);
				expect(lactation.images.breasts).toBe(
					`media/ui/lactation/boobs/color-0/${expected}`
				);
			}
		);
	});
});
