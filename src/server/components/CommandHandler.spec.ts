import { instanceItem, isDebugEnabled, sendServerCommand } from "@asledgehammer/pipewrench";
import {
	BF_NETWORK_MODULE,
	BF_PROTOCOL_SCHEMA_VERSION,
	BF_STATE_SCHEMA_VERSION,
	BF_STATE_MOD_DATA_KEY,
	BFTraitsEnum,
	BFNetworkCommand,
	BFSyncStatus
} from "@constants";
import { mockedPlayer } from "@test/mock";
import { CommandHandler } from "@server/components/CommandHandler";
import {
	createDefaultPregnancyState,
	PregnancyStatus
} from "@shared/domain/pregnancy/PregnancyState";
import { CharacterTraitApi } from "@shared/components/CharacterTraitApi";
import { createDefaultBirthState } from "@shared/domain/birth/BirthState";
import { createDefaultDomains } from "@shared/BFState";

const domains = createDefaultDomains;

jest.mock("@asledgehammer/pipewrench");
jest.mock("@shared/components/CharacterTraitApi");

describe("CommandHandler", () => {
	const sendMock = sendServerCommand as jest.MockedFunction<typeof sendServerCommand>;
	const debugMock = isDebugEnabled as jest.MockedFunction<typeof isDebugEnabled>;
	const addItemMock = sendAddItemToContainer as jest.MockedFunction<
		typeof sendAddItemToContainer
	>;
	const removeItemMock = sendRemoveItemFromContainer as jest.MockedFunction<
		typeof sendRemoveItemFromContainer
	>;
	const playerWithStore = (store: Record<string, unknown> = {}) =>
		mockedPlayer({ getModData: jest.fn().mockReturnValue(store) });

	beforeEach(() => {
		sendMock.mockReset();
		(instanceItem as jest.Mock).mockReset();
		addItemMock.mockReset();
		removeItemMock.mockReset();
		debugMock.mockReset();
		debugMock.mockReturnValue(false);
		delete (globalThis as { SandboxVars?: unknown }).SandboxVars;
	});

	it("filters unrelated routes and malformed raw args", () => {
		const handler = new CommandHandler();
		const player = mockedPlayer();
		handler.onClientCommand("Other", BFNetworkCommand.SYNC_STATE_REQUEST, player, {});
		handler.onClientCommand(BF_NETWORK_MODULE, "Other", player, {});
		handler.onClientCommand(
			BF_NETWORK_MODULE,
			BFNetworkCommand.SYNC_STATE_REQUEST,
			player,
			null
		);
		expect(sendMock).not.toHaveBeenCalled();
	});

	it("authoritatively replaces one condom from the player's main inventory", () => {
		const condom = {};
		const used = {};
		(instanceItem as jest.Mock).mockReturnValue(used);
		const inventory = {
			getFirstType: jest.fn().mockReturnValue(condom),
			Remove: jest.fn(),
			AddItem: jest.fn()
		};
		const player = playerWithStore();
		player.getInventory = jest.fn().mockReturnValue(inventory) as never;

		new CommandHandler().onClientCommand(
			BF_NETWORK_MODULE,
			BFNetworkCommand.CONVERT_CONDOM_REQUEST,
			player,
			{
				schemaVersion: BF_PROTOCOL_SCHEMA_VERSION,
				requestId: "condom-1",
				revision: 1,
				data: {}
			}
		);

		expect(inventory.getFirstType).toHaveBeenCalledWith("BF.Condom");
		expect(inventory.Remove).toHaveBeenCalledWith(condom);
		expect(removeItemMock).toHaveBeenCalledWith(inventory, condom);
		expect(instanceItem).toHaveBeenCalledWith("BF.CondomUsed");
		expect(inventory.AddItem).toHaveBeenCalledWith(used);
		expect(addItemMock).toHaveBeenCalledWith(inventory, used);
		expect(sendMock).not.toHaveBeenCalled();
	});

	it("does nothing when the main inventory has no condom", () => {
		const inventory = {
			getFirstType: jest.fn().mockReturnValue(undefined),
			AddItem: jest.fn()
		};
		const player = playerWithStore();
		player.getInventory = jest.fn().mockReturnValue(inventory) as never;

		new CommandHandler().onClientCommand(
			BF_NETWORK_MODULE,
			BFNetworkCommand.CONVERT_CONDOM_REQUEST,
			player,
			{
				schemaVersion: BF_PROTOCOL_SCHEMA_VERSION,
				requestId: "condom-1",
				revision: 1,
				data: {}
			}
		);

		expect(inventory.getFirstType).toHaveBeenCalledWith("BF.Condom");
		expect(instanceItem).not.toHaveBeenCalled();
		expect(inventory.AddItem).not.toHaveBeenCalled();
		expect(removeItemMock).not.toHaveBeenCalled();
		expect(addItemMock).not.toHaveBeenCalled();
	});

	it("rejects client-selected condom data without mutating inventory", () => {
		const inventory = { getFirstType: jest.fn(), AddItem: jest.fn() };
		const player = playerWithStore();
		player.getInventory = jest.fn().mockReturnValue(inventory) as never;

		new CommandHandler().onClientCommand(
			BF_NETWORK_MODULE,
			BFNetworkCommand.CONVERT_CONDOM_REQUEST,
			player,
			{
				schemaVersion: BF_PROTOCOL_SCHEMA_VERSION,
				requestId: "condom-selected",
				revision: 1,
				data: { itemId: 42 }
			}
		);

		expect(inventory.getFirstType).not.toHaveBeenCalled();
		expect(instanceItem).not.toHaveBeenCalled();
		expect(inventory.AddItem).not.toHaveBeenCalled();
	});

	it("ignores a command delivered before the server player is bound", () => {
		new CommandHandler().onClientCommand(
			BF_NETWORK_MODULE,
			BFNetworkCommand.SYNC_STATE_REQUEST,
			undefined,
			{}
		);

		expect(sendMock).not.toHaveBeenCalled();
	});

	it("returns a targeted persisted snapshot correlated to the request", () => {
		const handler = new CommandHandler();
		const player = playerWithStore();
		handler.onClientCommand(BF_NETWORK_MODULE, BFNetworkCommand.SYNC_STATE_REQUEST, player, {
			schemaVersion: BF_PROTOCOL_SCHEMA_VERSION,
			requestId: "snapshot-7",
			revision: 7,
			data: {}
		});
		expect(sendMock).toHaveBeenCalledWith(
			player,
			BF_NETWORK_MODULE,
			BFNetworkCommand.SYNC_STATE_RESPONSE,
			{
				schemaVersion: BF_PROTOCOL_SCHEMA_VERSION,
				requestId: "snapshot-7",
				revision: 7,
				status: BFSyncStatus.OK,
				data: {
					snapshot: {
						schemaVersion: BF_STATE_SCHEMA_VERSION,
						stateVersion: 0,
						domains: domains()
					}
				}
			}
		);
	});

	it("returns persisted state metadata without incrementing its version", () => {
		const handler = new CommandHandler();
		const player = playerWithStore({
			[BF_STATE_MOD_DATA_KEY]: {
				schemaVersion: 1,
				characterId: "test-character-id",
				stateVersion: 6,
				domains: domains()
			}
		});

		handler.onClientCommand(BF_NETWORK_MODULE, BFNetworkCommand.SYNC_STATE_REQUEST, player, {
			schemaVersion: BF_PROTOCOL_SCHEMA_VERSION,
			requestId: "snapshot-1",
			revision: 1,
			data: {}
		});

		expect(sendMock).toHaveBeenCalledWith(
			player,
			BF_NETWORK_MODULE,
			BFNetworkCommand.SYNC_STATE_RESPONSE,
			expect.objectContaining({
				status: BFSyncStatus.OK,
				data: {
					snapshot: {
						schemaVersion: BF_STATE_SCHEMA_VERSION,
						stateVersion: 6,
						domains: domains()
					}
				}
			})
		);
	});

	it("restores the server Pregnancy trait from persisted authoritative state on sync", () => {
		const player = playerWithStore({
			[BF_STATE_MOD_DATA_KEY]: {
				schemaVersion: 1,
				characterId: "test-character-id",
				stateVersion: 1,
				domains: {
					...domains(),
					birth: createDefaultBirthState(),
					pregnancy: {
						status: PregnancyStatus.PREGNANT,
						current: 0,
						progress: 0,
						isInLabor: false
					}
				}
			}
		});

		new CommandHandler().onClientCommand(
			BF_NETWORK_MODULE,
			BFNetworkCommand.SYNC_STATE_REQUEST,
			player,
			{
				schemaVersion: BF_PROTOCOL_SCHEMA_VERSION,
				requestId: "snapshot-1",
				revision: 1,
				data: {}
			}
		);

		expect(CharacterTraitApi.addTrait).toHaveBeenCalledWith(player, BFTraitsEnum.PREGNANCY);
	});

	it("reports an unsupported future persisted schema without overwriting it", () => {
		const persisted = { schemaVersion: 6, stateVersion: 9, domains: { future: true } };
		const store = { [BF_STATE_MOD_DATA_KEY]: persisted };
		const handler = new CommandHandler();
		const player = playerWithStore(store);

		handler.onClientCommand(BF_NETWORK_MODULE, BFNetworkCommand.SYNC_STATE_REQUEST, player, {
			schemaVersion: BF_PROTOCOL_SCHEMA_VERSION,
			requestId: "snapshot-1",
			revision: 1,
			data: {}
		});

		expect(sendMock).toHaveBeenCalledWith(
			player,
			BF_NETWORK_MODULE,
			BFNetworkCommand.SYNC_STATE_RESPONSE,
			expect.objectContaining({
				status: BFSyncStatus.UNSUPPORTED_DATA_SCHEMA,
				data: {
					snapshot: { schemaVersion: 6, stateVersion: 9, domains: domains() }
				}
			})
		);
		expect(store[BF_STATE_MOD_DATA_KEY]).toBe(persisted);
	});

	it("persists a valid debug Pregnancy mutation and increments state version", () => {
		debugMock.mockReturnValue(true);
		const store: Record<string, unknown> = {};
		const player = playerWithStore(store);
		new CommandHandler().onClientCommand(
			BF_NETWORK_MODULE,
			BFNetworkCommand.SET_PREGNANCY_STATE_REQUEST,
			player,
			{
				schemaVersion: BF_PROTOCOL_SCHEMA_VERSION,
				requestId: "pregnancy-1",
				revision: 1,
				data: {
					desired: {
						status: PregnancyStatus.PREGNANT,
						current: 0,
						progress: 0,
						isInLabor: false
					}
				}
			}
		);

		const persisted = store[BF_STATE_MOD_DATA_KEY] as {
			stateVersion: number;
			domains: { pregnancy: { status: PregnancyStatus } };
		};
		expect(persisted.stateVersion).toBe(1);
		expect(persisted.domains.pregnancy.status).toBe(PregnancyStatus.PREGNANT);
		expect(CharacterTraitApi.addTrait).toHaveBeenCalledWith(player, BFTraitsEnum.PREGNANCY);
		expect(sendMock).toHaveBeenCalledWith(
			player,
			BF_NETWORK_MODULE,
			BFNetworkCommand.SET_PREGNANCY_STATE_RESPONSE,
			expect.objectContaining({ status: BFSyncStatus.OK })
		);
	});

	it("persists normal Pregnancy progression without requiring debug mode", () => {
		const store = {
			[BF_STATE_MOD_DATA_KEY]: {
				schemaVersion: 1,
				characterId: "test-character-id",
				stateVersion: 1,
				domains: {
					...domains(),
					birth: createDefaultBirthState(),
					pregnancy: {
						status: PregnancyStatus.PREGNANT,
						current: 0,
						progress: 0,
						isInLabor: false
					}
				}
			}
		};
		const player = playerWithStore(store);

		new CommandHandler().onClientCommand(
			BF_NETWORK_MODULE,
			BFNetworkCommand.PUBLISH_PREGNANCY_STATE_REQUEST,
			player,
			{
				schemaVersion: BF_PROTOCOL_SCHEMA_VERSION,
				requestId: "pregnancy-1",
				revision: 1,
				data: {
					desired: {
						status: PregnancyStatus.PREGNANT,
						current: 1,
						progress: 0.1,
						isInLabor: false
					}
				}
			}
		);

		expect(store[BF_STATE_MOD_DATA_KEY].stateVersion).toBe(2);
		expect(store[BF_STATE_MOD_DATA_KEY].domains.pregnancy.current).toBe(1);
		expect(sendMock).toHaveBeenCalledWith(
			player,
			BF_NETWORK_MODULE,
			BFNetworkCommand.PUBLISH_PREGNANCY_STATE_RESPONSE,
			expect.objectContaining({ status: BFSyncStatus.OK })
		);
	});

	it("does not increment state version for an idempotent Pregnancy mutation", () => {
		debugMock.mockReturnValue(true);
		const store = {
			[BF_STATE_MOD_DATA_KEY]: {
				schemaVersion: 1,
				characterId: "test-character-id",
				stateVersion: 4,
				domains: domains()
			}
		};
		const player = playerWithStore(store);
		new CommandHandler().onClientCommand(
			BF_NETWORK_MODULE,
			BFNetworkCommand.SET_PREGNANCY_STATE_REQUEST,
			player,
			{
				schemaVersion: BF_PROTOCOL_SCHEMA_VERSION,
				requestId: "pregnancy-1",
				revision: 1,
				data: { desired: createDefaultPregnancyState() }
			}
		);

		expect(store[BF_STATE_MOD_DATA_KEY].stateVersion).toBe(4);
		expect(CharacterTraitApi.removeTrait).toHaveBeenCalledWith(player, BFTraitsEnum.PREGNANCY);
	});

	it("rejects Pregnancy mutation outside debug mode without changing state", () => {
		const store = {
			[BF_STATE_MOD_DATA_KEY]: {
				schemaVersion: 1,
				characterId: "test-character-id",
				stateVersion: 4,
				domains: domains()
			}
		};
		const player = playerWithStore(store);
		new CommandHandler().onClientCommand(
			BF_NETWORK_MODULE,
			BFNetworkCommand.SET_PREGNANCY_STATE_REQUEST,
			player,
			{
				schemaVersion: BF_PROTOCOL_SCHEMA_VERSION,
				requestId: "pregnancy-1",
				revision: 1,
				data: {
					desired: {
						status: PregnancyStatus.PREGNANT,
						current: 0,
						progress: 0,
						isInLabor: false
					}
				}
			}
		);

		expect(store[BF_STATE_MOD_DATA_KEY].stateVersion).toBe(4);
		expect(sendMock).toHaveBeenCalledWith(
			player,
			BF_NETWORK_MODULE,
			BFNetworkCommand.SET_PREGNANCY_STATE_RESPONSE,
			expect.objectContaining({ status: BFSyncStatus.FORBIDDEN })
		);
	});

	it("rejects inconsistent Pregnancy state without incrementing state version", () => {
		debugMock.mockReturnValue(true);
		const store = {
			[BF_STATE_MOD_DATA_KEY]: {
				schemaVersion: 1,
				characterId: "test-character-id",
				stateVersion: 4,
				domains: domains()
			}
		};
		const player = playerWithStore(store);
		new CommandHandler().onClientCommand(
			BF_NETWORK_MODULE,
			BFNetworkCommand.SET_PREGNANCY_STATE_REQUEST,
			player,
			{
				schemaVersion: BF_PROTOCOL_SCHEMA_VERSION,
				requestId: "pregnancy-1",
				revision: 1,
				data: {
					desired: {
						status: PregnancyStatus.NOT_PREGNANT,
						current: 1,
						progress: 0,
						isInLabor: false
					}
				}
			}
		);

		expect(store[BF_STATE_MOD_DATA_KEY].stateVersion).toBe(4);
		expect(sendMock).toHaveBeenCalledWith(
			player,
			BF_NETWORK_MODULE,
			BFNetworkCommand.SET_PREGNANCY_STATE_RESPONSE,
			expect.objectContaining({ status: BFSyncStatus.INVALID_REQUEST })
		);
	});

	it.each([2, 99])(
		"reports unsupported protocol schema %s using the current response envelope",
		requestSchemaVersion => {
			const handler = new CommandHandler();
			const player = mockedPlayer();
			handler.onClientCommand(
				BF_NETWORK_MODULE,
				BFNetworkCommand.SYNC_STATE_REQUEST,
				player,
				{
					schemaVersion: requestSchemaVersion,
					requestId: "snapshot-1",
					revision: 1,
					data: {}
				}
			);
			expect(sendMock).toHaveBeenCalledWith(
				player,
				BF_NETWORK_MODULE,
				BFNetworkCommand.SYNC_STATE_RESPONSE,
				expect.objectContaining({
					schemaVersion: BF_PROTOCOL_SCHEMA_VERSION,
					requestId: "snapshot-1",
					revision: 1,
					status: BFSyncStatus.UNSUPPORTED_SCHEMA
				})
			);
		}
	);

	it("allocates and persists a character-scoped birth operation during labor", () => {
		const store = {
			[BF_STATE_MOD_DATA_KEY]: {
				schemaVersion: 1,
				characterId: "test-character-id",
				stateVersion: 5,
				domains: {
					...domains(),
					birth: createDefaultBirthState(),
					pregnancy: {
						status: PregnancyStatus.PREGNANT,
						current: 100,
						progress: 1,
						isInLabor: true
					}
				}
			}
		};
		const player = mockedPlayer({
			getModData: jest.fn().mockReturnValue(store),
			getUsername: jest.fn().mockReturnValue("Dihgg")
		});
		const request = {
			schemaVersion: BF_PROTOCOL_SCHEMA_VERSION,
			requestId: "birth-1",
			revision: 1,
			data: {}
		};

		const handler = new CommandHandler();
		handler.onClientCommand(
			BF_NETWORK_MODULE,
			BFNetworkCommand.ALLOCATE_BIRTH_REQUEST,
			player,
			request
		);

		expect(store[BF_STATE_MOD_DATA_KEY].stateVersion).toBe(6);
		expect(store[BF_STATE_MOD_DATA_KEY].domains.birth).toEqual({
			birthSequence: 1,
			pendingBirthId: "test-character-id:birth:1"
		});
		expect(sendMock).toHaveBeenLastCalledWith(
			player,
			BF_NETWORK_MODULE,
			BFNetworkCommand.ALLOCATE_BIRTH_RESPONSE,
			expect.objectContaining({ status: BFSyncStatus.OK })
		);
	});

	it("returns the pending birth idempotently without advancing state version", () => {
		const store = {
			[BF_STATE_MOD_DATA_KEY]: {
				schemaVersion: 1,
				characterId: "test-character-id",
				stateVersion: 6,
				domains: {
					...domains(),
					birth: { birthSequence: 1, pendingBirthId: "Dihgg:birth:1" },
					pregnancy: {
						status: PregnancyStatus.PREGNANT,
						current: 100,
						progress: 1,
						isInLabor: true
					}
				}
			}
		};
		const player = mockedPlayer({
			getModData: jest.fn().mockReturnValue(store),
			getUsername: jest.fn().mockReturnValue("Dihgg")
		});

		new CommandHandler().onClientCommand(
			BF_NETWORK_MODULE,
			BFNetworkCommand.ALLOCATE_BIRTH_REQUEST,
			player,
			{
				schemaVersion: BF_PROTOCOL_SCHEMA_VERSION,
				requestId: "birth-retry",
				revision: 2,
				data: {}
			}
		);

		expect(store[BF_STATE_MOD_DATA_KEY].stateVersion).toBe(6);
		expect(store[BF_STATE_MOD_DATA_KEY].domains.birth.birthSequence).toBe(1);
	});

	it("rejects birth allocation before authoritative labor", () => {
		const store: Record<string, unknown> = {};
		const player = playerWithStore(store);

		new CommandHandler().onClientCommand(
			BF_NETWORK_MODULE,
			BFNetworkCommand.ALLOCATE_BIRTH_REQUEST,
			player,
			{
				schemaVersion: BF_PROTOCOL_SCHEMA_VERSION,
				requestId: "birth-early",
				revision: 1,
				data: {}
			}
		);

		expect(sendMock).toHaveBeenLastCalledWith(
			player,
			BF_NETWORK_MODULE,
			BFNetworkCommand.ALLOCATE_BIRTH_RESPONSE,
			expect.objectContaining({ status: BFSyncStatus.INVALID_REQUEST })
		);
	});

	it("rejects birth allocation for a dead character without changing pending state", () => {
		const store = {
			[BF_STATE_MOD_DATA_KEY]: {
				schemaVersion: 1,
				characterId: "test-character-id",
				stateVersion: 6,
				domains: {
					...domains(),
					birth: { birthSequence: 1, pendingBirthId: "Dihgg:birth:1" },
					pregnancy: {
						status: PregnancyStatus.PREGNANT,
						current: 100,
						progress: 1,
						isInLabor: true
					}
				}
			}
		};
		const player = mockedPlayer({
			getModData: jest.fn().mockReturnValue(store),
			isDead: jest.fn().mockReturnValue(true)
		});

		new CommandHandler().onClientCommand(
			BF_NETWORK_MODULE,
			BFNetworkCommand.ALLOCATE_BIRTH_REQUEST,
			player,
			{
				schemaVersion: BF_PROTOCOL_SCHEMA_VERSION,
				requestId: "birth-dead",
				revision: 1,
				data: {}
			}
		);

		expect(store[BF_STATE_MOD_DATA_KEY].stateVersion).toBe(6);
		expect(store[BF_STATE_MOD_DATA_KEY].domains.birth).toEqual({
			birthSequence: 1,
			pendingBirthId: "Dihgg:birth:1"
		});
		expect(sendMock).toHaveBeenLastCalledWith(
			player,
			BF_NETWORK_MODULE,
			BFNetworkCommand.ALLOCATE_BIRTH_RESPONSE,
			expect.objectContaining({ status: BFSyncStatus.INVALID_REQUEST })
		);
	});

	it("creates a durable baby and completes the authoritative birth", () => {
		(globalThis as { SandboxVars?: { BF?: BFSandboxOptions } }).SandboxVars = {
			BF: { PregnancyRecovery: 11 }
		};
		const itemModData: Record<string, unknown> = {};
		const baby = { getModData: jest.fn().mockReturnValue(itemModData) };
		(instanceItem as jest.Mock).mockReturnValue(baby);
		const AddItem = jest.fn();
		const descriptor = {
			getForename: jest.fn().mockReturnValue("Jane"),
			getSurname: jest.fn().mockReturnValue("Doe")
		};
		const store = {
			[BF_STATE_MOD_DATA_KEY]: {
				schemaVersion: 1,
				characterId: "test-character-id",
				stateVersion: 8,
				domains: {
					...domains(),
					birth: { birthSequence: 1, pendingBirthId: "Dihgg:birth:1" },
					pregnancy: {
						status: PregnancyStatus.PREGNANT,
						current: 100,
						progress: 1,
						isInLabor: true
					}
				}
			}
		};
		const inventory = { AddItem };
		const player = mockedPlayer({
			getModData: jest.fn().mockReturnValue(store),
			getUsername: jest.fn().mockReturnValue("Dihgg"),
			getFullName: jest.fn().mockReturnValue("Jane Doe"),
			getDescriptor: jest.fn().mockReturnValue(descriptor),
			getInventory: jest.fn().mockReturnValue(inventory)
		});

		new CommandHandler().onClientCommand(
			BF_NETWORK_MODULE,
			BFNetworkCommand.COMPLETE_BIRTH_REQUEST,
			player,
			{
				schemaVersion: BF_PROTOCOL_SCHEMA_VERSION,
				requestId: "complete-1",
				revision: 1,
				data: { birthId: "Dihgg:birth:1" }
			}
		);

		expect(AddItem).toHaveBeenCalledWith(baby);
		expect(itemModData.BF).toEqual({
			schemaVersion: 1,
			birthId: "Dihgg:birth:1",
			motherCharacterId: "test-character-id",
			motherUsername: "Dihgg",
			motherName: "Jane Doe",
			birthSequence: 1
		});
		expect(store[BF_STATE_MOD_DATA_KEY].domains.birth).toEqual({
			birthSequence: 1,
			completedBirthId: "Dihgg:birth:1"
		});
		expect(store[BF_STATE_MOD_DATA_KEY].domains.pregnancy).toEqual(
			createDefaultPregnancyState()
		);
		expect(store[BF_STATE_MOD_DATA_KEY].domains.womb).toEqual({
			cycleDay: -11,
			amount: 0,
			total: 0,
			onContraceptive: false
		});
	});

	it("acknowledges duplicate birth completion without another item or state revision", () => {
		const AddItem = jest.fn();
		const inventory = { AddItem };
		const store = {
			[BF_STATE_MOD_DATA_KEY]: {
				schemaVersion: 1,
				characterId: "test-character-id",
				stateVersion: 9,
				domains: {
					...domains(),
					birth: { birthSequence: 1, completedBirthId: "Dihgg:birth:1" }
				}
			}
		};
		const player = mockedPlayer({
			getModData: jest.fn().mockReturnValue(store),
			getInventory: jest.fn().mockReturnValue(inventory)
		});

		new CommandHandler().onClientCommand(
			BF_NETWORK_MODULE,
			BFNetworkCommand.COMPLETE_BIRTH_REQUEST,
			player,
			{
				schemaVersion: BF_PROTOCOL_SCHEMA_VERSION,
				requestId: "complete-retry",
				revision: 1,
				data: { birthId: "Dihgg:birth:1" }
			}
		);

		expect(AddItem).not.toHaveBeenCalled();
		expect(addItemMock).not.toHaveBeenCalled();
		expect(store[BF_STATE_MOD_DATA_KEY].stateVersion).toBe(9);
		expect(sendMock).toHaveBeenLastCalledWith(
			player,
			BF_NETWORK_MODULE,
			BFNetworkCommand.COMPLETE_BIRTH_RESPONSE,
			expect.objectContaining({ status: BFSyncStatus.OK })
		);
	});

	it("rejects dead-character completion without creating a baby or changing state", () => {
		const AddItem = jest.fn();
		const store = {
			[BF_STATE_MOD_DATA_KEY]: {
				schemaVersion: 1,
				characterId: "test-character-id",
				stateVersion: 8,
				domains: {
					...domains(),
					birth: { birthSequence: 1, pendingBirthId: "Dihgg:birth:1" },
					pregnancy: {
						status: PregnancyStatus.PREGNANT,
						current: 100,
						progress: 1,
						isInLabor: true
					}
				}
			}
		};
		const player = mockedPlayer({
			getModData: jest.fn().mockReturnValue(store),
			getInventory: jest.fn().mockReturnValue({ AddItem }),
			isDead: jest.fn().mockReturnValue(true)
		});

		new CommandHandler().onClientCommand(
			BF_NETWORK_MODULE,
			BFNetworkCommand.COMPLETE_BIRTH_REQUEST,
			player,
			{
				schemaVersion: BF_PROTOCOL_SCHEMA_VERSION,
				requestId: "complete-dead",
				revision: 1,
				data: { birthId: "Dihgg:birth:1" }
			}
		);

		expect(instanceItem).not.toHaveBeenCalled();
		expect(AddItem).not.toHaveBeenCalled();
		expect(addItemMock).not.toHaveBeenCalled();
		expect(store[BF_STATE_MOD_DATA_KEY].stateVersion).toBe(8);
		expect(store[BF_STATE_MOD_DATA_KEY].domains.birth).toEqual({
			birthSequence: 1,
			pendingBirthId: "Dihgg:birth:1"
		});
		expect(sendMock).toHaveBeenLastCalledWith(
			player,
			BF_NETWORK_MODULE,
			BFNetworkCommand.COMPLETE_BIRTH_RESPONSE,
			expect.objectContaining({ status: BFSyncStatus.INVALID_REQUEST })
		);
	});

	it("persists reversible Womb cycle progression", () => {
		const store = {
			[BF_STATE_MOD_DATA_KEY]: {
				schemaVersion: 1,
				characterId: "test-character-id",
				stateVersion: 3,
				domains: {
					...domains(),
					womb: { cycleDay: -7, amount: 0, total: 0, onContraceptive: false }
				}
			}
		};
		const player = playerWithStore(store);

		new CommandHandler().onClientCommand(
			BF_NETWORK_MODULE,
			BFNetworkCommand.PUBLISH_WOMB_STATE_REQUEST,
			player,
			{
				schemaVersion: BF_PROTOCOL_SCHEMA_VERSION,
				requestId: "womb-1",
				revision: 1,
				baseStateVersion: 3,
				data: {
					desired: {
						cycleDay: -6,
						amount: 0.2,
						total: 0.4,
						onContraceptive: false,
						future: true
					}
				}
			}
		);

		expect(store[BF_STATE_MOD_DATA_KEY].stateVersion).toBe(4);
		expect(store[BF_STATE_MOD_DATA_KEY].domains.womb).toEqual({
			cycleDay: -6,
			amount: 0.2,
			total: 0.4,
			onContraceptive: false
		});
		expect(sendMock).toHaveBeenLastCalledWith(
			player,
			BF_NETWORK_MODULE,
			BFNetworkCommand.PUBLISH_WOMB_STATE_RESPONSE,
			expect.objectContaining({ status: BFSyncStatus.OK })
		);
	});

	it("rejects stale contraceptive clearing but accepts the next versioned day change", () => {
		const store = {
			[BF_STATE_MOD_DATA_KEY]: {
				schemaVersion: 1,
				characterId: "test-character-id",
				stateVersion: 4,
				domains: {
					...domains(),
					womb: { cycleDay: 1, amount: 0, total: 0, onContraceptive: true }
				}
			}
		};
		const player = playerWithStore(store);
		const handler = new CommandHandler();
		const publish = (baseStateVersion: number, cycleDay: number) =>
			handler.onClientCommand(
				BF_NETWORK_MODULE,
				BFNetworkCommand.PUBLISH_WOMB_STATE_REQUEST,
				player,
				{
					schemaVersion: BF_PROTOCOL_SCHEMA_VERSION,
					requestId: `womb-${cycleDay}-${baseStateVersion}`,
					revision: baseStateVersion + 1,
					baseStateVersion,
					data: { desired: { cycleDay, amount: 0, total: 0, onContraceptive: false } }
				}
			);

		publish(3, 1);
		expect(store[BF_STATE_MOD_DATA_KEY].domains.womb.onContraceptive).toBe(true);
		expect(store[BF_STATE_MOD_DATA_KEY].stateVersion).toBe(4);
		publish(4, 2);
		expect(store[BF_STATE_MOD_DATA_KEY].domains.womb.onContraceptive).toBe(false);
		expect(store[BF_STATE_MOD_DATA_KEY].stateVersion).toBe(5);
	});

	it("persists complete Lactation only against the current authoritative version", () => {
		const store = {
			[BF_STATE_MOD_DATA_KEY]: {
				schemaVersion: 1,
				characterId: "test-character-id",
				stateVersion: 2,
				domains: domains()
			}
		};
		const player = playerWithStore(store);
		const handler = new CommandHandler();
		const desired = { isActive: true, milkAmount: 0.4, expiration: 8, multiplier: 0.2 };
		handler.onClientCommand(
			BF_NETWORK_MODULE,
			BFNetworkCommand.PUBLISH_LACTATION_STATE_REQUEST,
			player,
			{
				schemaVersion: BF_PROTOCOL_SCHEMA_VERSION,
				requestId: "lactation-stale",
				revision: 1,
				baseStateVersion: 1,
				data: { desired }
			}
		);
		expect(store[BF_STATE_MOD_DATA_KEY].stateVersion).toBe(2);
		handler.onClientCommand(
			BF_NETWORK_MODULE,
			BFNetworkCommand.PUBLISH_LACTATION_STATE_REQUEST,
			player,
			{
				schemaVersion: BF_PROTOCOL_SCHEMA_VERSION,
				requestId: "lactation-current",
				revision: 2,
				baseStateVersion: 2,
				data: { desired }
			}
		);
		expect(store[BF_STATE_MOD_DATA_KEY].stateVersion).toBe(3);
		expect(store[BF_STATE_MOD_DATA_KEY].domains.lactation).toEqual(desired);
	});
});
