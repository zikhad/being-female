import { Lactation } from "@client/components/Lactation";
import { Womb } from "@client/components/Womb";
import { ZLBFUI } from "@client/components/ZLBFUI";
import { Pregnancy } from "@client/components/Pregnancy";
import { ContextMenu } from "@client/components/ContextMenu";
import { Animation } from "@client/components/Animation";
import { SnapshotStore } from "@client/components/network/SnapshotStore";
import { SyncCoordinator } from "@client/components/network/SyncCoordinator";
import { SyncPublisher } from "@client/components/network/SyncPublisher";
import { PregnancyPublisher } from "@client/components/network/PregnancyPublisher";
import { BirthPublisher } from "@client/components/network/BirthPublisher";
import { WombPublisher } from "@client/components/network/WombPublisher";

export const lactation = new Lactation();
/** Read-only client mirror of the latest acknowledged authoritative snapshot. */
export const snapshots = new SnapshotStore();
/** Client publisher for reversible menstrual-cycle progression. */
export const wombPublisher = new WombPublisher(snapshots);
export const womb = new Womb(wombPublisher, snapshots);
/** Client request publisher and response correlator. */
export const syncPublisher = new SyncPublisher(snapshots);
/** Debug Pregnancy intent publisher and response correlator. */
export const pregnancyPublisher = new PregnancyPublisher(snapshots);
/** Client request publisher for server-owned birth operation allocation. */
export const birthPublisher = new BirthPublisher(snapshots);
export const pregnancy = new Pregnancy(pregnancyPublisher, snapshots, birthPublisher);
export const animation = new Animation(womb);
/** Singleton registration point for client synchronization events. */
export const syncCoordinator = new SyncCoordinator(syncPublisher, [
	syncPublisher,
	pregnancyPublisher,
	birthPublisher,
	wombPublisher
]);

export const UI = new ZLBFUI({
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
