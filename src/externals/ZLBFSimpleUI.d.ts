/** @noResolution */
/**
 * Type declarations for the ZLBF built-in Simple UI system.
 * Implemented in src/client/ZLBF/components/UI/ZLBFSimpleUI.lua
 */

interface ZLBFUIElement {
	setText: (text: string) => void;
	setValue: (value: number) => void;
	setPath: (path: string) => void;
	setVisible: (visible: boolean) => void;
}

type ZLBFUIImageOptions = {
	width?: number;
	height?: number;
};

interface ZLBFUIObject {
	// State
	yAct: number;
	isUIVisible: boolean;

	// Window methods
	setWidthPixel: (width: number) => void;
	setHeight: (height: number) => void;
	setTitle: (title: string) => void;
	titleBarHeight: () => number;
	setVisible: (state: boolean) => void;
	setPositionPixel: (x: number, y: number) => void;
	setPositionPercent: (x: number, y: number) => void;
	toggle: () => void;
	open: () => void;
	close: () => void;

	// Content methods
	addText: (
		id: string,
		text: string,
		font?: string,
		position?: "Center" | "Left" | "Right"
	) => void;
	nextLine: () => void;
	addProgressBar: (id: string, value: number, min: number, max: number) => void;
	addButton: (id: string, text: string, callback: () => void) => void;
	addImage: (id: string, imagePath: string, options?: ZLBFUIImageOptions) => void;

	// Layout methods
	setBorderToAllElements: (border: boolean) => void;
	saveLayout: () => void;
}

/** A ZLBF panel window; named elements are accessible as dynamic properties. */
type ZLBFSimpleUI = ZLBFUIObject & { [id: string]: ZLBFUIElement };

/** Create and register a new ZLBF panel window. */
declare const NewZLBFUI: () => ZLBFSimpleUI;

type ZLBFTabbedUI = {
	isUIVisible: boolean;
	yAct?: number;
	setWidthPixel: (width: number) => void;
	setTitle: (title: string) => void;
	toggle: () => void;
	open: () => void;
	close: () => void;
	removeFromUIManager: () => void;
	setVisible: (visible: boolean) => void;
	registerTab: (id: string, name: string) => void;
	setActiveTab: (name: string) => void;
	addText: (
		id: string,
		text: string,
		font?: string,
		position?: "Center" | "Left" | "Right"
	) => void;
	nextLine: () => void;
	addProgressBar: (id: string, value: number, min: number, max: number) => void;
	addButton: (id: string, text: string, callback: () => void) => void;
	addImage: (id: string, imagePath: string, options?: ZLBFUIImageOptions) => void;
	setBorderToAllElements: (border: boolean) => void;
	saveLayout: () => void;
} & { [id: string]: ZLBFUIElement | undefined };

/** Create and register the tabbed ZLBF PoC window. */
declare const NewZLBFTabbedUI: () => ZLBFTabbedUI;
