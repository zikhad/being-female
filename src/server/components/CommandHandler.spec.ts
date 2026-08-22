import { instanceItem, isDebugEnabled, sendServerCommand } from "@asledgehammer/pipewrench";
import {
	ZLBF_NETWORK_MODULE,
	ZLBF_PROTOCOL_SCHEMA_VERSION,
	ZLBF_STATE_SCHEMA_VERSION,
	ZLBF_STATE_MOD_DATA_KEY,
	ZLBFTraitsEnum,
	ZLBFNetworkCommand,
	ZLBFSyncStatus
} from "@constants";
import { mockedPlayer } from "@test/mock";
import { CommandHandler } from "@server/components/CommandHandler";
import {
	createDefaultPregnancyState,
	PregnancyStatus
} from "@shared/domain/pregnancy/PregnancyState";
import { CharacterTraitApi } from "@shared/components/CharacterTraitApi";
import { createDefaultBirthState } from "@shared/domain/birth/BirthState";
import { createDefaultDomains } from "@shared/ZLBFState";

const domains = createDefaultDomains;

jest.mock("@asledgehammer/pipewrench");
jest.mock("@shared/components/CharacterTraitApi");

describe("CommandHandler", () => {
	const sendMock = sendServerCommand as jest.MockedFunction<typeof sendServerCommand>;
	const debugMock = isDebugEnabled as jest.MockedFunction<typeof isDebugEnabled>;
	const playerWithStore = (store: Record<string, unknown> = {}) =>
		mockedPlayer({ getModData: jest.fn().mockReturnValue(store) });

	beforeEach(() => {
		sendMock.mockReset();
		(instanceItem as jest.Mock).mockReset();
		(
			globalThis as unknown as { sendAddItemToContainer: jest.Mock }
		).sendAddItemToContainer.mockReset();
		debugMock.mockReset();
		debugMock.mockReturnValue(false);
		delete (globalThis as { SandboxVars?: unknown }).SandboxVars;
	});

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

	it("ignores a command delivered before the server player is bound", () => {
		new CommandHandler().onClientCommand(
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.SYNC_STATE_REQUEST,
			undefined,
			{}
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
				data: {
					snapshot: {
						schemaVersion: ZLBF_STATE_SCHEMA_VERSION,
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
			[ZLBF_STATE_MOD_DATA_KEY]: {
				schemaVersion: 1,
				stateVersion: 6,
				domains: domains()
			}
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
				data: {
					snapshot: {
						schemaVersion: ZLBF_STATE_SCHEMA_VERSION,
						stateVersion: 6,
						domains: domains()
					}
				}
			})
		);
	});

	it("restores the server Pregnancy trait from persisted authoritative state on sync", () => {
		const player = playerWithStore({
			[ZLBF_STATE_MOD_DATA_KEY]: {
				schemaVersion: 1,
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

		expect(CharacterTraitApi.addTrait).toHaveBeenCalledWith(player, ZLBFTraitsEnum.PREGNANCY);
	});

	it("reports an unsupported future persisted schema without overwriting it", () => {
		const persisted = { schemaVersion: 6, stateVersion: 9, domains: { future: true } };
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
				data: {
					snapshot: { schemaVersion: 6, stateVersion: 9, domains: domains() }
				}
			})
		);
		expect(store[ZLBF_STATE_MOD_DATA_KEY]).toBe(persisted);
	});

	it("persists a valid debug Pregnancy mutation and increments state version", () => {
		debugMock.mockReturnValue(true);
		const store: Record<string, unknown> = {};
		const player = playerWithStore(store);
		new CommandHandler().onClientCommand(
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.SET_PREGNANCY_STATE_REQUEST,
			player,
			{
				schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
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

		const persisted = store[ZLBF_STATE_MOD_DATA_KEY] as {
			stateVersion: number;
			domains: { pregnancy: { status: PregnancyStatus } };
		};
		expect(persisted.stateVersion).toBe(1);
		expect(persisted.domains.pregnancy.status).toBe(PregnancyStatus.PREGNANT);
		expect(CharacterTraitApi.addTrait).toHaveBeenCalledWith(player, ZLBFTraitsEnum.PREGNANCY);
		expect(sendMock).toHaveBeenCalledWith(
			player,
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.SET_PREGNANCY_STATE_RESPONSE,
			expect.objectContaining({ status: ZLBFSyncStatus.OK })
		);
	});

	it("persists normal Pregnancy progression without requiring debug mode", () => {
		const store = {
			[ZLBF_STATE_MOD_DATA_KEY]: {
				schemaVersion: 1,
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
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.PUBLISH_PREGNANCY_STATE_REQUEST,
			player,
			{
				schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
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

		expect(store[ZLBF_STATE_MOD_DATA_KEY].stateVersion).toBe(2);
		expect(store[ZLBF_STATE_MOD_DATA_KEY].domains.pregnancy.current).toBe(1);
		expect(sendMock).toHaveBeenCalledWith(
			player,
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.PUBLISH_PREGNANCY_STATE_RESPONSE,
			expect.objectContaining({ status: ZLBFSyncStatus.OK })
		);
	});

	it("does not increment state version for an idempotent Pregnancy mutation", () => {
		debugMock.mockReturnValue(true);
		const store = {
			[ZLBF_STATE_MOD_DATA_KEY]: {
				schemaVersion: 1,
				stateVersion: 4,
				domains: domains()
			}
		};
		const player = playerWithStore(store);
		new CommandHandler().onClientCommand(
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.SET_PREGNANCY_STATE_REQUEST,
			player,
			{
				schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
				requestId: "pregnancy-1",
				revision: 1,
				data: { desired: createDefaultPregnancyState() }
			}
		);

		expect(store[ZLBF_STATE_MOD_DATA_KEY].stateVersion).toBe(4);
		expect(CharacterTraitApi.removeTrait).toHaveBeenCalledWith(
			player,
			ZLBFTraitsEnum.PREGNANCY
		);
	});

	it("rejects Pregnancy mutation outside debug mode without changing state", () => {
		const store = {
			[ZLBF_STATE_MOD_DATA_KEY]: {
				schemaVersion: 1,
				stateVersion: 4,
				domains: domains()
			}
		};
		const player = playerWithStore(store);
		new CommandHandler().onClientCommand(
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.SET_PREGNANCY_STATE_REQUEST,
			player,
			{
				schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
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

		expect(store[ZLBF_STATE_MOD_DATA_KEY].stateVersion).toBe(4);
		expect(sendMock).toHaveBeenCalledWith(
			player,
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.SET_PREGNANCY_STATE_RESPONSE,
			expect.objectContaining({ status: ZLBFSyncStatus.FORBIDDEN })
		);
	});

	it("rejects inconsistent Pregnancy state without incrementing state version", () => {
		debugMock.mockReturnValue(true);
		const store = {
			[ZLBF_STATE_MOD_DATA_KEY]: {
				schemaVersion: 1,
				stateVersion: 4,
				domains: domains()
			}
		};
		const player = playerWithStore(store);
		new CommandHandler().onClientCommand(
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.SET_PREGNANCY_STATE_REQUEST,
			player,
			{
				schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
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

		expect(store[ZLBF_STATE_MOD_DATA_KEY].stateVersion).toBe(4);
		expect(sendMock).toHaveBeenCalledWith(
			player,
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.SET_PREGNANCY_STATE_RESPONSE,
			expect.objectContaining({ status: ZLBFSyncStatus.INVALID_REQUEST })
		);
	});

	it.each([2, 99])(
		"reports unsupported protocol schema %s using the current response envelope",
		requestSchemaVersion => {
		const handler = new CommandHandler();
		const player = mockedPlayer();
		handler.onClientCommand(
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.SYNC_STATE_REQUEST,
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
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.SYNC_STATE_RESPONSE,
			expect.objectContaining({
				schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
				requestId: "snapshot-1",
				revision: 1,
				status: ZLBFSyncStatus.UNSUPPORTED_SCHEMA
			})
		);
		}
	);

	it("allocates and persists a character-scoped birth operation during labor", () => {
		const store = {
			[ZLBF_STATE_MOD_DATA_KEY]: {
				schemaVersion: 1,
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
			schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
			requestId: "birth-1",
			revision: 1,
			data: {}
		};

		const handler = new CommandHandler();
		handler.onClientCommand(
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.ALLOCATE_BIRTH_REQUEST,
			player,
			request
		);

		expect(store[ZLBF_STATE_MOD_DATA_KEY].stateVersion).toBe(6);
		expect(store[ZLBF_STATE_MOD_DATA_KEY].domains.birth).toEqual({
			birthSequence: 1,
			pendingBirthId: "test-character-id:birth:1"
		});
		expect(sendMock).toHaveBeenLastCalledWith(
			player,
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.ALLOCATE_BIRTH_RESPONSE,
			expect.objectContaining({ status: ZLBFSyncStatus.OK })
		);
	});

	it("returns the pending birth idempotently without advancing state version", () => {
		const store = {
			[ZLBF_STATE_MOD_DATA_KEY]: {
				schemaVersion: 1,
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
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.ALLOCATE_BIRTH_REQUEST,
			player,
			{
				schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
				requestId: "birth-retry",
				revision: 2,
				data: {}
			}
		);

		expect(store[ZLBF_STATE_MOD_DATA_KEY].stateVersion).toBe(6);
		expect(store[ZLBF_STATE_MOD_DATA_KEY].domains.birth.birthSequence).toBe(1);
	});

	it("rejects birth allocation before authoritative labor", () => {
		const store: Record<string, unknown> = {};
		const player = playerWithStore(store);

		new CommandHandler().onClientCommand(
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.ALLOCATE_BIRTH_REQUEST,
			player,
			{
				schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
				requestId: "birth-early",
				revision: 1,
				data: {}
			}
		);

		expect(sendMock).toHaveBeenLastCalledWith(
			player,
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.ALLOCATE_BIRTH_RESPONSE,
			expect.objectContaining({ status: ZLBFSyncStatus.INVALID_REQUEST })
		);
	});

	it("rejects birth allocation for a dead character without changing pending state", () => {
		const store = {
			[ZLBF_STATE_MOD_DATA_KEY]: {
				schemaVersion: 1,
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
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.ALLOCATE_BIRTH_REQUEST,
			player,
			{
				schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
				requestId: "birth-dead",
				revision: 1,
				data: {}
			}
		);

		expect(store[ZLBF_STATE_MOD_DATA_KEY].stateVersion).toBe(6);
		expect(store[ZLBF_STATE_MOD_DATA_KEY].domains.birth).toEqual({
			birthSequence: 1,
			pendingBirthId: "Dihgg:birth:1"
		});
		expect(sendMock).toHaveBeenLastCalledWith(
			player,
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.ALLOCATE_BIRTH_RESPONSE,
			expect.objectContaining({ status: ZLBFSyncStatus.INVALID_REQUEST })
		);
	});

	it("creates a durable baby and completes the authoritative birth", () => {
		(globalThis as { SandboxVars?: { ZLBF?: ZLBFSandboxOptions } }).SandboxVars = {
			ZLBF: { PregnancyRecovery: 11 }
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
			[ZLBF_STATE_MOD_DATA_KEY]: {
				schemaVersion: 1,
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
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.COMPLETE_BIRTH_REQUEST,
			player,
			{
				schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
				requestId: "complete-1",
				revision: 1,
				data: { birthId: "Dihgg:birth:1" }
			}
		);

		expect(AddItem).toHaveBeenCalledWith(baby);
		expect(itemModData.ZLBF).toEqual({
			schemaVersion: 2,
			birthId: "Dihgg:birth:1",
			motherCharacterId: "test-character-id",
			motherUsername: "Dihgg",
			motherName: "Jane Doe",
			birthSequence: 1
		});
		expect(store[ZLBF_STATE_MOD_DATA_KEY].domains.birth).toEqual({
			birthSequence: 1,
			completedBirthId: "Dihgg:birth:1"
		});
		expect(store[ZLBF_STATE_MOD_DATA_KEY].domains.pregnancy).toEqual(
			createDefaultPregnancyState()
		);
		expect(store[ZLBF_STATE_MOD_DATA_KEY].domains.womb).toEqual({
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
			[ZLBF_STATE_MOD_DATA_KEY]: {
				schemaVersion: 1,
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
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.COMPLETE_BIRTH_REQUEST,
			player,
			{
				schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
				requestId: "complete-retry",
				revision: 1,
				data: { birthId: "Dihgg:birth:1" }
			}
		);

		expect(AddItem).not.toHaveBeenCalled();
		expect(
			(globalThis as unknown as { sendAddItemToContainer: jest.Mock }).sendAddItemToContainer
		).not.toHaveBeenCalled();
		expect(store[ZLBF_STATE_MOD_DATA_KEY].stateVersion).toBe(9);
		expect(sendMock).toHaveBeenLastCalledWith(
			player,
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.COMPLETE_BIRTH_RESPONSE,
			expect.objectContaining({ status: ZLBFSyncStatus.OK })
		);
	});

	it("rejects dead-character completion without creating a baby or changing state", () => {
		const AddItem = jest.fn();
		const store = {
			[ZLBF_STATE_MOD_DATA_KEY]: {
				schemaVersion: 1,
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
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.COMPLETE_BIRTH_REQUEST,
			player,
			{
				schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
				requestId: "complete-dead",
				revision: 1,
				data: { birthId: "Dihgg:birth:1" }
			}
		);

		expect(instanceItem).not.toHaveBeenCalled();
		expect(AddItem).not.toHaveBeenCalled();
		expect(
			(globalThis as unknown as { sendAddItemToContainer: jest.Mock }).sendAddItemToContainer
		).not.toHaveBeenCalled();
		expect(store[ZLBF_STATE_MOD_DATA_KEY].stateVersion).toBe(8);
		expect(store[ZLBF_STATE_MOD_DATA_KEY].domains.birth).toEqual({
			birthSequence: 1,
			pendingBirthId: "Dihgg:birth:1"
		});
		expect(sendMock).toHaveBeenLastCalledWith(
			player,
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.COMPLETE_BIRTH_RESPONSE,
			expect.objectContaining({ status: ZLBFSyncStatus.INVALID_REQUEST })
		);
	});

	it("persists reversible Womb cycle progression", () => {
		const store = {
			[ZLBF_STATE_MOD_DATA_KEY]: {
				schemaVersion: 1,
				stateVersion: 3,
				domains: {
					...domains(),
					womb: { cycleDay: -7, amount: 0, total: 0, onContraceptive: false }
				}
			}
		};
		const player = playerWithStore(store);

		new CommandHandler().onClientCommand(
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.PUBLISH_WOMB_STATE_REQUEST,
			player,
			{
				schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
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

		expect(store[ZLBF_STATE_MOD_DATA_KEY].stateVersion).toBe(4);
		expect(store[ZLBF_STATE_MOD_DATA_KEY].domains.womb).toEqual({
			cycleDay: -6,
			amount: 0.2,
			total: 0.4,
			onContraceptive: false
		});
		expect(sendMock).toHaveBeenLastCalledWith(
			player,
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.PUBLISH_WOMB_STATE_RESPONSE,
			expect.objectContaining({ status: ZLBFSyncStatus.OK })
		);
	});

	it("rejects stale contraceptive clearing but accepts the next versioned day change", () => {
		const store = {
			[ZLBF_STATE_MOD_DATA_KEY]: {
				schemaVersion: 1,
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
				ZLBF_NETWORK_MODULE,
				ZLBFNetworkCommand.PUBLISH_WOMB_STATE_REQUEST,
				player,
				{
					schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
					requestId: `womb-${cycleDay}-${baseStateVersion}`,
					revision: baseStateVersion + 1,
					baseStateVersion,
					data: { desired: { cycleDay, amount: 0, total: 0, onContraceptive: false } }
				}
			);

		publish(3, 1);
		expect(store[ZLBF_STATE_MOD_DATA_KEY].domains.womb.onContraceptive).toBe(true);
		expect(store[ZLBF_STATE_MOD_DATA_KEY].stateVersion).toBe(4);
		publish(4, 2);
		expect(store[ZLBF_STATE_MOD_DATA_KEY].domains.womb.onContraceptive).toBe(false);
		expect(store[ZLBF_STATE_MOD_DATA_KEY].stateVersion).toBe(5);
	});

	it("persists complete Lactation only against the current authoritative version", () => {
		const store = {
			[ZLBF_STATE_MOD_DATA_KEY]: { schemaVersion: 1, stateVersion: 2, domains: domains() }
		};
		const player = playerWithStore(store);
		const handler = new CommandHandler();
		const desired = { isActive: true, milkAmount: 0.4, expiration: 8, multiplier: 0.2 };
		handler.onClientCommand(
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.PUBLISH_LACTATION_STATE_REQUEST,
			player,
			{
				schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
				requestId: "lactation-stale",
				revision: 1,
				baseStateVersion: 1,
				data: { desired }
			}
		);
		expect(store[ZLBF_STATE_MOD_DATA_KEY].stateVersion).toBe(2);
		handler.onClientCommand(
			ZLBF_NETWORK_MODULE,
			ZLBFNetworkCommand.PUBLISH_LACTATION_STATE_REQUEST,
			player,
			{
				schemaVersion: ZLBF_PROTOCOL_SCHEMA_VERSION,
				requestId: "lactation-current",
				revision: 2,
				baseStateVersion: 2,
				data: { desired }
			}
		);
		expect(store[ZLBF_STATE_MOD_DATA_KEY].stateVersion).toBe(3);
		expect(store[ZLBF_STATE_MOD_DATA_KEY].domains.lactation).toEqual(desired);
	});
});
