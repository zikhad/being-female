import { IsoPlayer } from "@asledgehammer/pipewrench";
import * as Events from "@asledgehammer/pipewrench-events";
import { ZLBFSyncPublisher } from "@client/components/ZLBFSyncPublisher";

export class ZLBFSyncCoordinator {
	constructor(private readonly publisher: ZLBFSyncPublisher) {
		Events.onCreatePlayer.addListener((_, player: IsoPlayer) =>
			this.publisher.bindPlayer(player)
		);
		Events.everyOneMinute.addListener(() => this.publisher.onEveryOneMinute());
		Events.onServerCommand.addListener((module, command, args) =>
			this.publisher.onServerCommand(module, command, args)
		);
	}
}
