import { IsoPlayer } from "@asledgehammer/pipewrench";
import { BFTraitsEnum } from "@constants";
import { CharacterTraitApi } from "@shared/components/CharacterTraitApi";
import type { PregnancyData } from "@types";
import { ModData } from "@client/components/ModData";

const DEFAULT_PREGNANCY_DATA: PregnancyData = {
	current: 0,
	progress: 0,
	isInLabor: false
};

export class PregnancyState {
	private static readonly modKey = "BFPregnancy";

	private static getStore(player: IsoPlayer): ModData<PregnancyData> {
		return new ModData<PregnancyData>({
			object: player,
			modKey: this.modKey,
			defaultData: DEFAULT_PREGNANCY_DATA
		});
	}

	public static initialize(player: IsoPlayer): void {
		this.getStore(player);
	}

	public static get(player?: IsoPlayer): PregnancyData | null {
		if (!player) return null;
		if (!CharacterTraitApi.hasTrait(player, BFTraitsEnum.PREGNANCY)) return null;
		return this.getStored(player);
	}

	/**
	 * Reads legacy Pregnancy presentation data without using the synchronized trait as presence.
	 * Authoritative callers must establish Pregnancy status before using this compatibility data.
	 */
	public static getStored(player?: IsoPlayer): PregnancyData | null {
		if (!player) return null;
		return this.getStore(player).data ?? null;
	}

	public static set(player: IsoPlayer | undefined, value: PregnancyData): void {
		if (!player) return;
		this.getStore(player).data = value;
	}
}
