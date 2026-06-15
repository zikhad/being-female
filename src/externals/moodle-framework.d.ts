type MFTexture = ReturnType<typeof import("@asledgehammer/pipewrench").getTexture>;
type IsoPlayer = import("@asledgehammer/pipewrench").IsoPlayer;

type MFMoodle = {
	setThresholds: (
		...args: Array<number | undefined>
	) => void;
	setPicture: (goodBadNeutral: number, level: number, texture: MFTexture) => void;
	// setPicture: (trasholds: unknown, level: number, texture: MFTexture) => void;
	setValue: (level: number) => void;
	getGoodBadNeutral: () => number;
	getLevel: () => number;
};
type MFGlobalApi = {
	/** Lua OOP prototype — use bracket `["new"]` syntax to call `MF.ISMoodle:new(name, player)` */
	ISMoodle?: {
		new: (this: void, self: unknown, name: string, player: IsoPlayer) => void;
	};
	/** Lua dot-function — `this: void` prevents TSTL from generating a colon call */
	createMoodle?: (this: void, name: string) => void;
	/** Lua dot-function — `this: void` prevents TSTL from generating a colon call */
	getMoodle?: (this: void, name: string) => MFMoodle;
}

type MFReadyGlobalApi = {
	createMoodle: NonNullable<MFGlobalApi["createMoodle"]>;
	getMoodle: NonNullable<MFGlobalApi["getMoodle"]>;
	ISMoodle: NonNullable<MFGlobalApi["ISMoodle"]>;
}

/** @noResolution */
declare const MF: MFGlobalApi;
