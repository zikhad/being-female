import * as Events from "@asledgehammer/pipewrench-events";
import { Lactation } from "@client/components/Lactation";
import { Pregnancy } from "@client/components/Pregnancy";
import { Womb } from "@client/components/Womb";
import {
	getSpecificPlayer,
	getText,
	isDebugEnabled,
	KahluaTable,
	triggerEvent
} from "@asledgehammer/pipewrench";
import { ISToolTip } from "@asledgehammer/pipewrench/client";
import { BFEventsEnum } from "@constants";

export type Option = {
	title: string;
	description: string;
	fn: () => void;
};

type DebugMenuProps = {
	lactation: Lactation;
	pregnancy: Pregnancy;
	womb: Womb;
	options: Option[];
};

type AddOptionProps = {
	menu: {
		addOption: (...__args: unknown[]) => { toolTip: ISToolTip };
	};
	title: string;
	description: string;
	fn: () => void;
};

type ContextMenuProps = {
	playerId: number;
	context: {
		addOption: (...__args: unknown[]) => { toolTip: ISToolTip };
		addSubMenu: (option: KahluaTable, submenu: KahluaTable) => void;
	};
};
export class ContextMenu {
	private lactation: Lactation;
	private pregnancy: Pregnancy;
	private womb: Womb;

	constructor(props: DebugMenuProps) {
		const { lactation, pregnancy, womb, options } = props;

		this.lactation = lactation;
		this.pregnancy = pregnancy;
		this.womb = womb;

		Events.onFillWorldObjectContextMenu.addListener((playerId, context) => {
			this.createContextMenu({ playerId, context, options });
			if (isDebugEnabled()) {
				this.createDebugContextMenu({ playerId, context });
			}
		});
	}

	private addOption(props: AddOptionProps) {
		const { menu, title, description, fn } = props;
		const tooltip = new ISToolTip();

		tooltip.description = description;
		tooltip.instantiate();
		tooltip.setVisible(false);

		const option = menu.addOption(title, null, () => fn());
		option.toolTip = tooltip;
	}

	private createContextMenu(props: ContextMenuProps & { options: Option[] }) {
		const { playerId, context, options } = props;
		const player = getSpecificPlayer(playerId);
		if (!player.isFemale()) return;
		for (const { title, description, fn } of options) {
			this.addOption({
				menu: context,
				title,
				description,
				fn
			});
		}
	}

	private createDebugContextMenu(props: ContextMenuProps) {
		const { playerId, context } = props;

		const option = context.addOption(getText("ContextMenu_BF_Being_Female_Debug_Title"));
		const submenu = ISContextMenu.getNew(context);

		context.addSubMenu(option, submenu);

		const options = [
			{
				option: "Add_Sperm",
				fn: () => this.womb.Debug.sperm.add(0.1)
			},
			{
				option: "Remove_Sperm",
				fn: () => this.womb.Debug.sperm.set(0)
			},
			{
				option: "Reset_Sperm",
				fn: () => this.womb.Debug.sperm.setTotal(0)
			},
			{
				option: "Add_Cycle_Day",
				fn: () => this.womb.Debug.cycle.addDay(1),
				condition: () => this.pregnancy.pregnancy == null
			},
			{
				option: "Next_Cycle",
				fn: () => this.womb.Debug.cycle.nextPhase(),
				condition: () => this.pregnancy.pregnancy == null
			},
			{
				option: "Milk_Toggle",
				fn: () => this.lactation.Debug.toggle(!this.lactation.isLactating)
			},
			{
				option: "Milk_Add_Milk",
				fn: () => this.lactation.Debug.add(this.lactation.bottleAmount),
				condition: () => this.lactation.isLactating
			},
			{
				option: "Milk_Clear_Milk",
				fn: () => this.lactation.Debug.set(0),
				condition: () => this.lactation.isLactating
			},
			{
				option: "Add_Pregnancy",
				fn: () => this.pregnancy.Debug.start(),
				condition: () => this.pregnancy.pregnancy == null
			},
			{
				option: "Remove_Pregnancy",
				fn: () => this.pregnancy.Debug.stop(),
				condition: () => this.pregnancy.pregnancy != null
			},
			{
				option: "Advance_Pregnancy",
				// advance 1 day
				fn: () => this.pregnancy.Debug.advance(60 * 24),
				condition: () => this.pregnancy.pregnancy != null
			},
			{
				option: "Advance_Pregnancy_Labor",
				fn: () => this.pregnancy.Debug.advanceToLabor(),
				condition: () => this.pregnancy.pregnancy != null
			},
			{
				option: "Intercourse",
				fn: () => triggerEvent(BFEventsEnum.INTERCOURSE)
			},
			{
				option: "Menstrual_Effects",
				fn: () => triggerEvent(BFEventsEnum.MENSTRUAL_EFFECTS)
			}
		]
			.filter(({ condition }) => {
				return !(condition && !condition());
			})
			.map<Option>(({ option, fn }) => ({
				title: getText(`ContextMenu_${option}_Title`),
				description: getText(`ContextMenu_${option}_Description`),
				fn
			}));

		this.createContextMenu({
			playerId,
			context: submenu,
			options
		});
	}
}
