/* eslint-disable @typescript-eslint/no-explicit-any */
import * as SpyPipewrench from "@asledgehammer/pipewrench";
import { ANIMATIONS, AnimationRegistry } from "@client/components/AnimationRegistry";
import * as fs from "node:fs";
import * as path from "node:path";

jest.mock("@asledgehammer/pipewrench");
jest.mock("@asledgehammer/pipewrench-events");

/** Creates the zero-based Java-list surface used by the Build 42 globals. */
const javaList = <T>(values: T[]) => ({
	size: () => values.length,
	get: (index: number) => values[index]
});

/** Creates a buffered-reader surface over the supplied manifest text. */
const manifestReader = (contents: string) => {
	const lines = contents.trim().split("\n");
	let index = 0;
	return {
		readLine: jest.fn(() => lines[index++] ?? null),
		close: jest.fn()
	};
};

describe("AnimationRegistry", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		(SpyPipewrench.getActivatedMods as jest.Mock).mockReturnValue(javaList([]));
	});

	it("loads the virtual winner once when multiple mods expose the same manifest path", () => {
		(SpyPipewrench.getActivatedMods as jest.Mock).mockReturnValue(javaList(["BF", "Provider"]));
		(globalThis as any).listFilesInModDirectory = jest
			.fn()
			.mockReturnValue(javaList(["intercourse.txt"]));
		const reader = manifestReader(`
			version=1
			name=intercourse
			category=intercourse
			frameCount=2
			loop=3
			fullness=empty,full
		`);
		(SpyPipewrench.getModFileReader as jest.Mock).mockReturnValue(reader);

		const registry = new AnimationRegistry();
		registry.reload();

		expect(SpyPipewrench.getModFileReader).toHaveBeenCalledTimes(1);
		expect(SpyPipewrench.getModFileReader).toHaveBeenCalledWith(
			"Provider",
			"media/BF/animations/intercourse.txt",
			false
		);
		expect(registry.get(ANIMATIONS.INTERCOURSE)).toContainEqual({
			name: "intercourse",
			steps: [0, 1],
			loop: 3,
			path: "media/ui/animation",
			fullnessSupport: ["empty", "full"],
			birth: undefined,
			fertilization: undefined,
			pregnancy: undefined,
			condom: undefined
		});
		expect(reader.close).toHaveBeenCalledTimes(1);
	});

	it("does not register an invalid winning manifest", () => {
		(SpyPipewrench.getActivatedMods as jest.Mock).mockReturnValue(javaList(["Provider"]));
		(globalThis as any).listFilesInModDirectory = jest
			.fn()
			.mockReturnValue(javaList(["birth.txt"]));
		(SpyPipewrench.getModFileReader as jest.Mock).mockReturnValue(
			manifestReader(`
				version=1
				name=birth
				category=birth
				frameCount=0
			`)
		);

		const registry = new AnimationRegistry();
		registry.reload();

		expect(registry.get(ANIMATIONS.BIRTH).some(animation => animation.name === "birth")).toBe(
			false
		);
	});

	it("rejects fullness metadata outside intercourse animations", () => {
		(SpyPipewrench.getActivatedMods as jest.Mock).mockReturnValue(javaList(["Provider"]));
		(globalThis as any).listFilesInModDirectory = jest
			.fn()
			.mockReturnValue(javaList(["provider-birth.txt"]));
		(SpyPipewrench.getModFileReader as jest.Mock).mockReturnValue(
			manifestReader(`
				version=1
				name=provider-birth
				category=birth
				frameCount=3
				fullness=empty
			`)
		);

		const registry = new AnimationRegistry();
		registry.reload();

		expect(
			registry.get(ANIMATIONS.BIRTH).some(animation => animation.name === "provider-birth")
		).toBe(false);
	});

	it("loads every shipped manifest as the sole built-in definition source", () => {
		const directory = path.join(process.cwd(), "src/media/BF/animations");
		const filenames = fs.readdirSync(directory).filter(filename => filename.endsWith(".txt"));
		(SpyPipewrench.getActivatedMods as jest.Mock).mockReturnValue(javaList(["BF"]));
		(globalThis as any).listFilesInModDirectory = jest
			.fn()
			.mockReturnValue(javaList(filenames));
		(SpyPipewrench.getModFileReader as jest.Mock).mockImplementation(
			(_modId: string, manifestPath: string) =>
				manifestReader(
					fs.readFileSync(path.join(process.cwd(), "src", manifestPath), "utf8")
				)
		);

		const registry = new AnimationRegistry();
		expect(registry.get(ANIMATIONS.INTERCOURSE)).toHaveLength(0);
		registry.reload();

		expect(registry.get(ANIMATIONS.INTERCOURSE)).toHaveLength(17);
		expect(registry.get(ANIMATIONS.BIRTH)).toHaveLength(5);
		expect(registry.get(ANIMATIONS.FERTILIZATION)).toHaveLength(6);
		expect(registry.get(ANIMATIONS.INTERCOURSE)[0].name).toBe("condom");
		expect(
			registry.get(ANIMATIONS.INTERCOURSE).find(item => item.name === "intercourse")?.steps
		).toHaveLength(170);
	});

	it("rejects unknown keys instead of silently ignoring provider typos", () => {
		(SpyPipewrench.getActivatedMods as jest.Mock).mockReturnValue(javaList(["Provider"]));
		(globalThis as any).listFilesInModDirectory = jest
			.fn()
			.mockReturnValue(javaList(["provider-animation.txt"]));
		(SpyPipewrench.getModFileReader as jest.Mock).mockReturnValue(
			manifestReader(`
				version=1
				name=provider-animation
				category=intercourse
				frameCount=3
				weigth=2
			`)
		);

		const registry = new AnimationRegistry();
		registry.reload();

		expect(
			registry
				.get(ANIMATIONS.INTERCOURSE)
				.some(animation => animation.name === "provider-animation")
		).toBe(false);
	});
});
