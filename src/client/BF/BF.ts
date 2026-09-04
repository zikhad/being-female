import { Lactation } from "@client/components/Lactation";
import { Womb } from "@client/components/Womb";
import { BFUI } from "@client/components/BFUI";
import { Pregnancy } from "@client/components/Pregnancy";
import { ContextMenu } from "@client/components/ContextMenu";
import { Animation } from "@client/components/Animation";
import { SnapshotStore } from "@client/components/network/SnapshotStore";
import { SyncCoordinator } from "@client/components/network/SyncCoordinator";
import { SyncPublisher } from "@client/components/network/SyncPublisher";
import { PregnancyPublisher } from "@client/components/network/PregnancyPublisher";
import { BirthPublisher } from "@client/components/network/BirthPublisher";
import { WombPublisher } from "@client/components/network/WombPublisher";
import { RecipeSnapshotReceiver } from "@client/components/network/RecipeSnapshotReceiver";
import { LactationPublisher } from "@client/components/network/LactationPublisher";
import { isClient } from "@asledgehammer/pipewrench";
import { installBFEvents } from "@client/BFEvents";
import { CondomPublisher } from "@client/components/network/CondomPublisher";
import { animationRegistry } from "@client/components/AnimationRegistry";

installBFEvents();
animationRegistry.install();

/** Whether this Lua context is a multiplayer client that requires command synchronization. */
const multiplayerClient = typeof isClient === "function" && isClient();

/** Read-only client mirror of the latest acknowledged authoritative snapshot. */
export const snapshots = new SnapshotStore();
/** Publishes complete reversible Lactation simulation. */
export const lactationPublisher = new LactationPublisher(snapshots);
export const lactation = new Lactation(
	multiplayerClient ? snapshots : undefined,
	multiplayerClient ? lactationPublisher : undefined
);
/** Client publisher for reversible menstrual-cycle progression. */
export const wombPublisher = new WombPublisher(snapshots);
/** Requests server-authoritative replacement of exact used condom items. */
export const condomPublisher = new CondomPublisher();
export const womb = new Womb(
	multiplayerClient ? wombPublisher : undefined,
	multiplayerClient ? snapshots : undefined,
	multiplayerClient ? condomPublisher : undefined
);
/** Applies server-authoritative recipe mutation acknowledgements. */
export const recipeSnapshots = new RecipeSnapshotReceiver(snapshots);
/** Client request publisher and response correlator. */
export const syncPublisher = new SyncPublisher(snapshots);
/** Debug Pregnancy intent publisher and response correlator. */
export const pregnancyPublisher = new PregnancyPublisher(snapshots);
/** Client request publisher for server-owned birth operation allocation. */
export const birthPublisher = new BirthPublisher(snapshots);
export const pregnancy = new Pregnancy(
	multiplayerClient ? pregnancyPublisher : undefined,
	multiplayerClient ? snapshots : undefined,
	multiplayerClient ? birthPublisher : undefined
);
export const animation = new Animation(womb);
/** Singleton registration point for client synchronization events. */
export const syncCoordinator = multiplayerClient
	? new SyncCoordinator({
			commandReceivers: [
				syncPublisher,
				pregnancyPublisher,
				birthPublisher,
				wombPublisher,
				lactationPublisher,
				recipeSnapshots
			],
			sessionResettables: [
				snapshots,
				syncPublisher,
				pregnancyPublisher,
				birthPublisher,
				wombPublisher,
				lactationPublisher
			],
			minutePublishers: [syncPublisher, birthPublisher]
		})
	: undefined;

export const UI = new BFUI({
	lactation,
	pregnancy,
	womb
});

export const contextMenu = new ContextMenu({
	lactation,
	pregnancy,
	womb,
	options: []
});
