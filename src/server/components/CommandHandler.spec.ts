import { sendServerCommand } from "@asledgehammer/pipewrench";
import {
	ZLBF_NETWORK_MODULE,
	ZLBF_PROTOCOL_SCHEMA_VERSION,
	ZLBF_STATE_MOD_DATA_KEY,
	ZLBFNetworkCommand,
	ZLBFSyncStatus
} from "@constants";
import { mockedPlayer } from "@test/mock";
import { CommandHandler } from "@server/components/CommandHandler";

jest.mock("@asledgehammer/pipewrench");

describe("CommandHandler", () => {
	const sendMock = sendServerCommand as jest.MockedFunction<typeof sendServerCommand>;
	const playerWithStore = (store: Record<string, unknown> = {}) =>
		mockedPlayer({ getModData: jest.fn().mockReturnValue(store) });

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

	it("returns a targeted persisted snapshot correlated to the request", () => {
		const handler = new CommandHandler();
		const player = playerWithStore();
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

	it("returns persisted state metadata without incrementing its version", () => {
		const handler = new CommandHandler();
		const player = playerWithStore({
			[ZLBF_STATE_MOD_DATA_KEY]: { dataSchemaVersion: 1, stateVersion: 6, domains: {} }
		});

		handler.onClientCommand(
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.SYNC_STATE_REQUEST,
			player,
			{
				schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
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
				status: ZLBFSyncStatus.OK,
				data: { snapshot: { dataSchemaVersion: 1, stateVersion: 6 } }
			})
		);
	});

	it("reports an unsupported future persisted schema without overwriting it", () => {
		const persisted = { dataSchemaVersion: 5, stateVersion: 9, domains: { future: true } };
		const store = { [ZLBF_STATE_MOD_DATA_KEY]: persisted };
		const handler = new CommandHandler();
		const player = playerWithStore(store);

		handler.onClientCommand(
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.SYNC_STATE_REQUEST,
			player,
			{
				schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
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
				status: ZLBFSyncStatus.UNSUPPORTED_DATA_SCHEMA,
				data: { snapshot: { dataSchemaVersion: 5, stateVersion: 9 } }
			})
		);
		expect(store[ZLBF_STATE_MOD_DATA_KEY]).toBe(persisted);
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
