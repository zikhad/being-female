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

export const lactation = new Lactation();
export const womb = new Womb();
/** Read-only client mirror of the latest acknowledged authoritative snapshot. */
export const snapshots = new SnapshotStore();
/** Client request publisher and response correlator. */
export const syncPublisher = new SyncPublisher(snapshots);
/** Debug Pregnancy intent publisher and response correlator. */
export const pregnancyPublisher = new PregnancyPublisher(snapshots);
export const pregnancy = new Pregnancy(pregnancyPublisher, snapshots);
export const animation = new Animation(womb);
/** Singleton registration point for client synchronization events. */
export const syncCoordinator = new SyncCoordinator(syncPublisher, [
	syncPublisher,
	pregnancyPublisher
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
