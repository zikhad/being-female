import { ModDataProps } from "types";

/**
 * Wrapper around `object.getModData()` to ensure the data can be retrieve type safely
 */
export class ModData<T> {
	private object: ModDataProps<T>["object"];
	private readonly modKey: string;
	private readonly defaultData?: T;

	constructor({ object, modKey, defaultData }: ModDataProps<T>) {
		this.object = object;
		this.modKey = modKey;
		this.defaultData = defaultData;
	}

	/**
	 * Safely retrieve some data from `object.getModData()`
	 * @returns The data in expected format
	 */
	get data() {
		if (!this.object.getModData()[this.modKey]) {
			this.object.getModData()[this.modKey] = this.defaultData;
		}
		return this.object.getModData()[this.modKey];
	}

	set data(value: T | undefined) {
		this.object.getModData()[this.modKey] = value;
	}
}
