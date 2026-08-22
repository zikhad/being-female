/** @noResolution */
/**
 * Type declarations for the BF built-in Simple UI system.
 * Implemented in src/client/BF/components/UI/BFSimpleUI.lua
 */

interface BFUIElement {
	setText: (text: string) => void;
	setValue: (value: number) => void;
	setPath: (path: string) => void;
	setVisible: (visible: boolean) => void;
}

type BFUIImageOptions = {
	width?: number;
	height?: number;
};

interface BFUIObject {
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
	addImage: (id: string, imagePath: string, options?: BFUIImageOptions) => void;

	// Layout methods
	setBorderToAllElements: (border: boolean) => void;
	saveLayout: () => void;
}

/** A BF panel window; named elements are accessible as dynamic properties. */
type BFSimpleUI = BFUIObject & { [id: string]: BFUIElement };

/** Create and register a new BF panel window. */
declare const NewBFUI: () => BFSimpleUI;

type BFTabbedUI = {
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
	addImage: (id: string, imagePath: string, options?: BFUIImageOptions) => void;
	setBorderToAllElements: (border: boolean) => void;
	saveLayout: () => void;
} & { [id: string]: BFUIElement | undefined };

/** Create and register the tabbed BF PoC window. */
declare const NewBFTabbedUI: () => BFTabbedUI;
