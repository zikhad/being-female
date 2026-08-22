import type { Fluid } from "@shared/components/FluidContainerApi";

export enum BFTraitsEnum {
	INFERTILE = "bf:infertile",
	FERTILE = "bf:fertile",
	HYPERFERTILE = "bf:hyperfertile",
	PREGNANCY = "bf:pregnancy",
	DAIRY_COW = "bf:dairycow",
	STRONG_MENSTRUAL_CRAMPS = "bf:strongmenstrualcramps",
	NO_MENSTRUAL_CRAMPS = "bf:nomenstrualcramps"
}

export enum CyclePhaseEnum {
	RECOVERY = "Recovery",
	MENSTRUATION = "Menstruation",
	FOLLICULAR = "Follicular",
	OVULATION = "Ovulation",
	LUTEAL = "Luteal",
	PREGNANT = "Pregnant"
}

export enum BFEventsEnum {
	PREGNANCY_UPDATE = "BFPregnancyUpdate",
	LACTATION_UPDATE = "BFLactationUpdate",
	WOMB_UPDATE = "BFWombUpdate",
	INTERCOURSE = "BFIntercourse",
	MENSTRUAL_EFFECTS = "BFMenstrualEffects",
	PREGNANCY_START = "BFPregnancyStart",
	PREGNANCY_STOP = "BFPregnancyStop",
	PREGNANCY_LABOR = "BFPregnancyLabor",
	ANIMATION_START = "BFWombAnimationStart",
	ANIMATION_UPDATE = "BFWombAnimationUpdate",
	ANIMATION_STOP = "BFWombAnimationStop",
	IMAGE = "BFWombImage"
}

export enum ITEMS {
	CONDOM = "BF.Condom",
	CONDOM_BOX = "BF.CondomBox",
	CONDOM_USED = "BF.CondomUsed",
	LACTAID = "BF.Lactaid",
	CONTRACEPTIVE = "BF.Contraceptive",
	VAGINAL_DOUCHE = "BF.VaginalDouche",
	BREAST_PUMP = "BF.BreastPump",
	BABY = "BF.Baby"
}

export const Fluids: Record<string, Fluid> = {
	HUMAN_MILK: "HumanMilk",
	SEMEN: "Semen"
};

export enum MODS {
	ZOMBOLUST = "ZomboLust",
	MOODLE_FRAMEWORK = "MoodleFramework"
}

export enum BFAnimations {
	TAKE_PILLS = "BF.TakePills",
	BIRTH = "BF.Birth",
	PUMP_MILK = "BF.PumpMilk",
	CLEAN_SELF = "BF.CleanSelf"
}

/** Project Zomboid command module used by all BF network messages. */
export const BF_NETWORK_MODULE = "BF";
/** Current version of the BF request/response envelope. */
export const BF_PROTOCOL_SCHEMA_VERSION = 1;
/** Current version of the persisted authoritative BF state shape. */
export const BF_STATE_SCHEMA_VERSION = 1;
/** Player ModData key containing the server-owned authoritative root. */
export const BF_STATE_MOD_DATA_KEY = "BF.State";

/** Commands supported by the initial BF state-synchronization transport. */
export enum BFNetworkCommand {
	SYNC_STATE_REQUEST = "SyncStateRequest",
	SYNC_STATE_RESPONSE = "SyncStateResponse",
	SET_PREGNANCY_STATE_REQUEST = "SetPregnancyStateRequest",
	SET_PREGNANCY_STATE_RESPONSE = "SetPregnancyStateResponse",
	PUBLISH_PREGNANCY_STATE_REQUEST = "PublishPregnancyStateRequest",
	PUBLISH_PREGNANCY_STATE_RESPONSE = "PublishPregnancyStateResponse",
	ALLOCATE_BIRTH_REQUEST = "AllocateBirthRequest",
	ALLOCATE_BIRTH_RESPONSE = "AllocateBirthResponse",
	COMPLETE_BIRTH_REQUEST = "CompleteBirthRequest",
	COMPLETE_BIRTH_RESPONSE = "CompleteBirthResponse",
	PUBLISH_WOMB_STATE_REQUEST = "PublishWombStateRequest",
	PUBLISH_WOMB_STATE_RESPONSE = "PublishWombStateResponse",
	PUBLISH_LACTATION_STATE_REQUEST = "PublishLactationStateRequest",
	PUBLISH_LACTATION_STATE_RESPONSE = "PublishLactationStateResponse",
	RECIPE_STATE_RESPONSE = "RecipeStateResponse"
}

/** Outcomes returned by the server for a BF sync request. */
export enum BFSyncStatus {
	OK = "OK",
	INVALID_REQUEST = "INVALID_REQUEST",
	UNSUPPORTED_SCHEMA = "UNSUPPORTED_SCHEMA",
	UNSUPPORTED_DATA_SCHEMA = "UNSUPPORTED_DATA_SCHEMA",
	FORBIDDEN = "FORBIDDEN"
}
