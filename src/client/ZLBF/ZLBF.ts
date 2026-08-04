import { Lactation } from "@client/components/Lactation";
import { Womb } from "@client/components/Womb";
import { ZLBFUI } from "@client/components/ZLBFUI";
import { Pregnancy } from "@client/components/Pregnancy";
import { ContextMenu } from "@client/components/ContextMenu";
import { Animation } from "@client/components/Animation";
import { ZLBFSnapshotStore } from "@client/components/ZLBFSnapshotStore";
import { ZLBFSyncCoordinator } from "@client/components/ZLBFSyncCoordinator";
import { ZLBFSyncPublisher } from "@client/components/ZLBFSyncPublisher";

export const lactation = new Lactation();
export const womb = new Womb();
export const pregnancy = new Pregnancy();
export const animation = new Animation(womb);
export const snapshots = new ZLBFSnapshotStore();
export const syncPublisher = new ZLBFSyncPublisher(snapshots);
export const syncCoordinator = new ZLBFSyncCoordinator(syncPublisher);

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
