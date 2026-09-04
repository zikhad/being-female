import * as Events from "@asledgehammer/pipewrench-events";
import { BFEventsEnum } from "@constants";

/** Public BF custom events registered before components and external integrations use them. */
const BF_EVENTS: ReadonlyArray<BFEventsEnum> = [
	BFEventsEnum.PREGNANCY_UPDATE,
	BFEventsEnum.LACTATION_UPDATE,
	BFEventsEnum.WOMB_UPDATE,
	BFEventsEnum.INTERCOURSE,
	BFEventsEnum.MENSTRUAL_EFFECTS,
	BFEventsEnum.PREGNANCY_START,
	BFEventsEnum.PREGNANCY_STOP,
	BFEventsEnum.PREGNANCY_LABOR,
	BFEventsEnum.ANIMATION_START,
	BFEventsEnum.ANIMATION_UPDATE,
	BFEventsEnum.ANIMATION_STOP,
	BFEventsEnum.IMAGE
];

/** Guards module-level BF event registration against duplicate initialization. */
let installed = false;

/**
 * Registers every public BF custom event with Project Zomboid's Lua event manager.
 * Repeated calls are safe and do not register an event more than once through this module.
 */
export const installBFEvents = (): void => {
	if (installed) return;
	installed = true;

	for (const event of BF_EVENTS) new Events.EventEmitter(event);
};
