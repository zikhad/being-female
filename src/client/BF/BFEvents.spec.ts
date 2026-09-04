import * as Events from "@asledgehammer/pipewrench-events";
import { BFEventsEnum } from "@constants";
import { installBFEvents } from "./BFEvents";

jest.mock("@asledgehammer/pipewrench-events");

describe("BFEvents", () => {
	const eventEmitter = jest.spyOn(Events, "EventEmitter").mockImplementation(() => ({}) as never);

	it("registers every public BF event exactly once", () => {
		installBFEvents();
		installBFEvents();

		expect(eventEmitter).toHaveBeenCalledTimes(12);
		expect(eventEmitter.mock.calls).toEqual(Object.values(BFEventsEnum).map(event => [event]));
	});
});
