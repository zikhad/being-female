import { BFUITabContext, BFUITabDefinition } from "@client/components/UI/BFUITabDefinition";
import { LactationTab } from "@client/components/UI/tabs/LactationTab";
import { WombTab } from "@client/components/UI/tabs/WombTab";

export { BFUITabContext, BFUITabDefinition, LactationTab, WombTab };

/**
 * Default set of BF UI tabs (order matters).
 */
export const defaultBFUITabs: BFUITabDefinition[] = [new WombTab(), new LactationTab()];
