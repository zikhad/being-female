import { getActivatedMods, triggerEvent, type IsoGameCharacter } from "@asledgehammer/pipewrench";
import { MODS, BFEventsEnum } from "@constants";

declare const ZomboDesire: {
	AnimationConfigs: Record<
		string,
		{
			Tags?: Record<string, string>;
			tags?: Record<string, string>;
		}
	>;
};
type ActionInstanceType = {
	character: IsoGameCharacter;
	stageConfig?: {
		animName: string;
	};
};

const hasTag = (tag: string, tags: Record<string, string>) => {
	for (const [key, value] of pairs(tags)) {
		if ([key, value].includes(tag)) return true;
	}
	return false;
};
export function onAnimationEvent(
	actionInstance: ActionInstanceType,
	_eventName?: string,
	_parameter?: string
) {
	if (!getActivatedMods().contains(MODS.ZOMBOLUST)) return;
	if (!ZomboDesire || !ZomboDesire.AnimationConfigs) return;

	const { character, stageConfig } = actionInstance;
	if (character.isZombie() || !character.isFemale()) return;

	if (!stageConfig?.animName) {
		return;
	}

	const { animName } = stageConfig;
	const globalConfig = ZomboDesire.AnimationConfigs[animName];
	if (!globalConfig) {
		return;
	}

	const tags = globalConfig.tags ?? globalConfig.Tags ?? {};
	const hasPregnancyTag = hasTag("Pregnancy", tags);

	if (hasPregnancyTag) {
		triggerEvent(BFEventsEnum.INTERCOURSE);
	}
}
