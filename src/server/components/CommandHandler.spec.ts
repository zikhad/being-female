import { sendServerCommand } from "@asledgehammer/pipewrench";
import {
	ZLBF_NETWORK_MODULE,
	ZLBF_PROTOCOL_SCHEMA_VERSION,
	ZLBFNetworkCommand,
	ZLBFSyncStatus
} from "@constants";
import { mockedPlayer } from "@test/mock";
import { CommandHandler } from "@server/components/CommandHandler";

jest.mock("@asledgehammer/pipewrench");

describe("CommandHandler", () => {
	const sendMock = sendServerCommand as jest.MockedFunction<typeof sendServerCommand>;

	beforeEach(() => sendMock.mockReset());

	it("filters unrelated routes and malformed raw args", () => {
		const handler = new CommandHandler();
		const player = mockedPlayer();
		handler.onClientCommand("Other", ZLBFNetworkCommand.SYNC_STATE_REQUEST, player, {});
		handler.onClientCommand(ZLBF_NETWORK_MODULE, "Other", player, {});
		handler.onClientCommand(
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.SYNC_STATE_REQUEST,
			player,
			null
		);
		expect(sendMock).not.toHaveBeenCalled();
	});

	it("returns a targeted stateless snapshot correlated to the request", () => {
		const handler = new CommandHandler();
		const player = mockedPlayer();
		handler.onClientCommand(
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.SYNC_STATE_REQUEST,
			player,
			{
				schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
				requestId: "snapshot-7",
				revision: 7,
				data: {}
			}
		);
		expect(sendMock).toHaveBeenCalledWith(
			player,
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.SYNC_STATE_RESPONSE,
			{
				schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
				requestId: "snapshot-7",
				revision: 7,
				status: ZLBFSyncStatus.OK,
				data: { snapshot: { dataSchemaVersion: 1, stateVersion: 0 } }
			}
		);
	});

	it("reports unsupported schema using the supported response envelope", () => {
		const handler = new CommandHandler();
		const player = mockedPlayer();
		handler.onClientCommand(
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.SYNC_STATE_REQUEST,
			player,
			{
				schemaVersion: 99,
				requestId: "snapshot-1",
				revision: 1,
				data: {}
			}
		);
		expect(sendMock).toHaveBeenCalledWith(
			player,
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.SYNC_STATE_RESPONSE,
			expect.objectContaining({
				schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
				requestId: "snapshot-1",
				revision: 1,
				status: ZLBFSyncStatus.UNSUPPORTED_SCHEMA
			})
		);
	});
});
