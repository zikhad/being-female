import { IsoPlayer } from "@asledgehammer/pipewrench";

/** Stable account and character identity read from an authenticated player. */
export type PlayerIdentity = {
	/** Server-unique account username used for operation identity. */
	username: string;
	/** Character forename and surname captured for role-play presentation. */
	name: string;
};

/** Environment-neutral wrapper around one explicitly supplied `IsoPlayer`. */
export class Player {
	/** Creates a wrapper around a player, or an unbound client lifecycle base. */
	public constructor(public player?: IsoPlayer) {}

	/** Binds an unbound wrapper to a concrete lifecycle player. */
	protected bind(player: IsoPlayer): void {
		this.player = player;
	}

	/** Reads validated identity without accepting the engine's missing-descriptor fallback. */
	public get identity(): PlayerIdentity | undefined {
		const player = this.player;
		const descriptor = player?.getDescriptor();
		if (!player || !descriptor) return undefined;
		const username = player.getUsername();
		const name = player.getFullName();
		if (!username || !name) return undefined;
		return { username, name };
	}
}
