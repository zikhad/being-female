import * as PipeWrench from "@asledgehammer/pipewrench";
import * as Events from "@asledgehammer/pipewrench-events";
import { BFEventsEnum } from "@constants";
import { emitBFNotification, installLegacyEventCompatibility } from "./LegacyEventCompatibility";

/** Captured custom-event listeners installed by the compatibility boundary. */
const mockListeners = new Map<string, (...payload: unknown[]) => void>();
/** Constructor calls made for compatibility event emitters. */
jest.mock("@asledgehammer/pipewrench");
jest.mock("@asledgehammer/pipewrench-events");

describe("LegacyEventCompatibility", () => {
	const triggerEvent = jest.spyOn(PipeWrench, "triggerEvent");
	/** Notification contracts exercised for BF-first dual emission. */
	const notificationCases: ReadonlyArray<
		readonly [Parameters<typeof emitBFNotification>[0], string]
	> = [
		[BFEventsEnum.PREGNANCY_UPDATE, "ZLBFPregnancyUpdate"],
		[BFEventsEnum.LACTATION_UPDATE, "ZLBFLactationUpdate"],
		[BFEventsEnum.WOMB_UPDATE, "ZLBFWombUpdate"],
		[BFEventsEnum.PREGNANCY_LABOR, "ZLBFPregnancyLabor"]
	];

	beforeAll(() => {
		jest.spyOn(Events, "EventEmitter").mockImplementation(
			(event: string) =>
				({
					addListener: (listener: (...payload: unknown[]) => void) =>
						mockListeners.set(event, listener)
				}) as never
		);
		installLegacyEventCompatibility();
	});

	beforeEach(() => triggerEvent.mockClear());

	it("installs every legacy command bridge exactly once", () => {
		installLegacyEventCompatibility();
		installLegacyEventCompatibility();

		expect(Events.EventEmitter).toHaveBeenCalledTimes(8);
		expect([...mockListeners.keys()]).toEqual([
			"ZLBFIntercourse",
			"ZLBFMenstrualEffects",
			"ZLBFPregnancyStart",
			"ZLBFPregnancyStop",
			"ZLBFWombAnimationStart",
			"ZLBFWombAnimationUpdate",
			"ZLBFWombAnimationStop",
			"ZLBFWombImage"
		]);
	});

	it.each([
		["ZLBFIntercourse", BFEventsEnum.INTERCOURSE],
		["ZLBFMenstrualEffects", BFEventsEnum.MENSTRUAL_EFFECTS],
		["ZLBFPregnancyStart", BFEventsEnum.PREGNANCY_START],
		["ZLBFPregnancyStop", BFEventsEnum.PREGNANCY_STOP],
		["ZLBFWombAnimationStart", BFEventsEnum.ANIMATION_START],
		["ZLBFWombAnimationUpdate", BFEventsEnum.ANIMATION_UPDATE],
		["ZLBFWombAnimationStop", BFEventsEnum.ANIMATION_STOP],
		["ZLBFWombImage", BFEventsEnum.IMAGE]
	])("forwards %s once to %s with unchanged payload", (legacyEvent, bfEvent) => {
		const payload = { marker: "same-reference" };
		mockListeners.get(legacyEvent)!(payload, 7);

		expect(triggerEvent).toHaveBeenCalledTimes(1);
		expect(triggerEvent).toHaveBeenCalledWith(bfEvent, payload, 7);
		expect(triggerEvent).not.toHaveBeenCalledWith(legacyEvent, payload, 7);
	});

	it.each(notificationCases)(
		"emits %s before legacy notification %s",
		(bfEvent: Parameters<typeof emitBFNotification>[0], legacyEvent) => {
			const payload = { marker: "same-reference" };
			emitBFNotification(bfEvent, payload, 7);

			expect(triggerEvent.mock.calls).toEqual([
				[bfEvent, payload, 7],
				[legacyEvent, payload, 7]
			]);
		}
	);
});
