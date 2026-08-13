import { IsoPlayer, SurvivorDesc } from "@asledgehammer/pipewrench";
import { Player } from "@shared/components/Player";
import { mock } from "jest-mock-extended";

describe("shared Player", () => {
	it("reads account and character identity from the supplied player", () => {
		const descriptor = mock<SurvivorDesc>({
			getForename: jest.fn().mockReturnValue("Jane"),
			getSurname: jest.fn().mockReturnValue("Doe")
		});
		const player = mock<IsoPlayer>({
			getDescriptor: jest.fn().mockReturnValue(descriptor),
			getUsername: jest.fn().mockReturnValue("Dihgg"),
			getFullName: jest.fn().mockReturnValue("Jane Doe")
		});

		expect(new Player(player).identity).toEqual({ username: "Dihgg", name: "Jane Doe" });
	});

	it.each([
		undefined,
		mock<IsoPlayer>({ getDescriptor: jest.fn().mockReturnValue(undefined) }),
		mock<IsoPlayer>({
			getDescriptor: jest.fn().mockReturnValue(
				mock<SurvivorDesc>({
					getForename: jest.fn().mockReturnValue(""),
					getSurname: jest.fn().mockReturnValue("Doe")
				})
			)
		})
	])("rejects incomplete identity %#", player => {
		expect(new Player(player).identity).toBeUndefined();
	});
});
