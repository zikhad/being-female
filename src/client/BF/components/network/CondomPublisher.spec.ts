import { getPlayer, sendClientCommand } from "@asledgehammer/pipewrench";
import { CondomPublisher } from "@client/components/network/CondomPublisher";
import { BF_NETWORK_MODULE, BFNetworkCommand } from "@constants";

jest.mock("@asledgehammer/pipewrench");

describe("CondomPublisher", () => {
	const sendMock = sendClientCommand as jest.MockedFunction<typeof sendClientCommand>;

	beforeEach(() => sendMock.mockReset());

	it("requests a server-authoritative conversion without selecting an item", () => {
		const publisher = new CondomPublisher();

		publisher.convert();
		publisher.convert();

		expect(sendMock).toHaveBeenNthCalledWith(
			1,
			getPlayer(),
			BF_NETWORK_MODULE,
			BFNetworkCommand.CONVERT_CONDOM_REQUEST,
			{
				schemaVersion: 1,
				requestId: "condom-1",
				revision: 1,
				data: {}
			}
		);
		expect(sendMock).toHaveBeenNthCalledWith(
			2,
			getPlayer(),
			BF_NETWORK_MODULE,
			BFNetworkCommand.CONVERT_CONDOM_REQUEST,
			{
				schemaVersion: 1,
				requestId: "condom-2",
				revision: 2,
				data: {}
			}
		);
	});
});
