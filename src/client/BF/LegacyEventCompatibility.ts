import { triggerEvent } from "@asledgehammer/pipewrench";
import * as Events from "@asledgehammer/pipewrench-events";
import { BFEventsEnum } from "@constants";

/** Legacy command aliases supported for external integrations. */
const LEGACY_COMMAND_EVENTS: ReadonlyArray<readonly [string, BFEventsEnum]> = [
	["ZLBFIntercourse", BFEventsEnum.INTERCOURSE],
	["ZLBFMenstrualEffects", BFEventsEnum.MENSTRUAL_EFFECTS],
	["ZLBFPregnancyStart", BFEventsEnum.PREGNANCY_START],
	["ZLBFPregnancyStop", BFEventsEnum.PREGNANCY_STOP],
	["ZLBFWombAnimationStart", BFEventsEnum.ANIMATION_START],
	["ZLBFWombAnimationUpdate", BFEventsEnum.ANIMATION_UPDATE],
	["ZLBFWombAnimationStop", BFEventsEnum.ANIMATION_STOP],
	["ZLBFWombImage", BFEventsEnum.IMAGE]
];

/** BF events whose external contract requires dual notification emission. */
type BFNotificationEvent =
	| BFEventsEnum.PREGNANCY_UPDATE
	| BFEventsEnum.LACTATION_UPDATE
	| BFEventsEnum.WOMB_UPDATE
	| BFEventsEnum.PREGNANCY_LABOR;

/** BF notification events paired with their legacy external aliases. */
const NOTIFICATION_EVENT_ALIASES: ReadonlyArray<readonly [BFNotificationEvent, string]> = [
	[BFEventsEnum.PREGNANCY_UPDATE, "ZLBFPregnancyUpdate"],
	[BFEventsEnum.LACTATION_UPDATE, "ZLBFLactationUpdate"],
	[BFEventsEnum.WOMB_UPDATE, "ZLBFWombUpdate"],
	[BFEventsEnum.PREGNANCY_LABOR, "ZLBFPregnancyLabor"]
];

/** Guards the module-level compatibility installation against duplicate listeners. */
let installed = false;

/**
 * Installs one-way legacy-command forwarding into the active BF event namespace.
 * Repeated calls are safe and never add duplicate listeners.
 */
export const installLegacyEventCompatibility = (): void => {
	if (installed) return;
	installed = true;

	for (const [legacyEvent, bfEvent] of LEGACY_COMMAND_EVENTS) {
		new Events.EventEmitter<(...payload: unknown[]) => void>(legacyEvent).addListener(
			(...payload: unknown[]) => triggerEvent(bfEvent, ...payload)
		);
	}

	for (const [bfEvent, legacyEvent] of NOTIFICATION_EVENT_ALIASES) {
		new Events.EventEmitter(bfEvent);
		new Events.EventEmitter(legacyEvent);
	}
};

/**
 * Emits an active BF notification followed by its legacy alias with the same payload.
 *
 * @param event BF notification event to publish.
 * @param payload Positional event payload forwarded unchanged to both event names.
 */
export const emitBFNotification = (event: BFNotificationEvent, ...payload: unknown[]): void => {
	triggerEvent(event, ...payload);
	for (const [bfEvent, legacyEvent] of NOTIFICATION_EVENT_ALIASES) {
		if (bfEvent === event) {
			triggerEvent(legacyEvent, ...payload);
			return;
		}
	}
};
