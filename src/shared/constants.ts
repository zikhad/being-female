import type { Fluid } from "server/types";

export enum ZLBFTraitsEnum {
	INFERTILE = "zlbf:infertile",
	FERTILE = "zlbf:fertile",
	HYPERFERTILE = "zlbf:hyperfertile",
	PREGNANCY = "zlbf:pregnancy",
	DAIRY_COW = "zlbf:dairycow",
	STRONG_MENSTRUAL_CRAMPS = "zlbf:strongmenstrualcramps",
	NO_MENSTRUAL_CRAMPS = "zlbf:nomenstrualcramps"
}

export enum CyclePhaseEnum {
	RECOVERY = "Recovery",
	MENSTRUATION = "Menstruation",
	FOLLICULAR = "Follicular",
	OVULATION = "Ovulation",
	LUTEAL = "Luteal",
	PREGNANT = "Pregnant"
}

export enum ZLBFEventsEnum {
	PREGNANCY_UPDATE = "ZLBFPregnancyUpdate",
	LACTATION_UPDATE = "ZLBFLactationUpdate",
	WOMB_UPDATE = "ZLBFWombUpdate",
	INTERCOURSE = "ZLBFIntercourse",
	MENSTRUAL_EFFECTS = "ZLBFMenstrualEffects",
	PREGNANCY_START = "ZLBFPregnancyStart",
	PREGNANCY_STOP = "ZLBFPregnancyStop",
	PREGNANCY_LABOR = "ZLBFPregnancyLabor",
	ANIMATION_START = "ZLBFWombAnimationStart",
	ANIMATION_UPDATE = "ZLBFWombAnimationUpdate",
	ANIMATION_STOP = "ZLBFWombAnimationStop",
	IMAGE = "ZLBFWombImage"
}

export enum ITEMS {
	CONDOM = "ZLBF.Condom",
	CONDOM_BOX = "ZLBF.CondomBox",
	CONDOM_USED = "ZLBF.CondomUsed",
	LACTAID = "ZLBF.Lactaid",
	CONTRACEPTIVE = "ZLBF.Contraceptive",
	VAGINAL_DOUCHE = "ZLBF.VaginalDouche",
	BREAST_PUMP = "ZLBF.BreastPump",
	BABY = "ZLBF.Baby"
}

export const Fluids: Record<string, Fluid> = {
	HUMAN_MILK: "HumanMilk",
	SEMEN: "Semen"
};

export enum MODS {
	ZOMBOLUST = "ZomboLust",
	MOODLE_FRAMEWORK = "MoodleFramework"
}

export enum ZLBFAnimations {
	TAKE_PILLS = "ZLBF.TakePills",
	BIRTH = "ZLBF.Birth",
	PUMP_MILK = "ZLBF.PumpMilk",
	CLEAN_SELF = "ZLBF.CleanSelf"
}

/** Project Zomboid command module used by all ZLBF network messages. */
export const ZLBF_NETWORK_MODULE = "ZLBF";
/** Current version of the ZLBF request/response envelope. */
export const ZLBF_PROTOCOL_SCHEMA_VERSION = 1;
/** Current version of the authoritative ZLBF domain-data shape. */
export const ZLBF_DATA_SCHEMA_VERSION = 2;
/** Player ModData key containing the server-owned authoritative root. */
export const ZLBF_STATE_MOD_DATA_KEY = "ZLBF.AuthoritativeState";

/** Commands supported by the initial ZLBF state-synchronization transport. */
export enum ZLBFNetworkCommand {
	SYNC_STATE_REQUEST = "SyncStateRequest",
	SYNC_STATE_RESPONSE = "SyncStateResponse",
	SET_PREGNANCY_STATE_REQUEST = "SetPregnancyStateRequest",
	SET_PREGNANCY_STATE_RESPONSE = "SetPregnancyStateResponse"
}

/** Outcomes returned by the server for a ZLBF sync request. */
export enum ZLBFSyncStatus {
	OK = "OK",
	INVALID_REQUEST = "INVALID_REQUEST",
	UNSUPPORTED_SCHEMA = "UNSUPPORTED_SCHEMA",
	UNSUPPORTED_DATA_SCHEMA = "UNSUPPORTED_DATA_SCHEMA",
	FORBIDDEN = "FORBIDDEN"
}
