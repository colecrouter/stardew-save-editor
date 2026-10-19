import { readFile } from "node:fs/promises";
import { flushSync } from "svelte";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setup as mockIDB } from "vitest-indexeddb";
import { Raw } from "$lib/proxies";
import { describeProblems, validateSave } from "$lib/saveValidation";
import { XMLManager } from "$lib/workers/xml";
import {
	SaveManager,
	SaveValidationError,
} from "../src/lib/SaveManager.svelte";

const locationNamed = (parsed: SaveFile, name: string) => {
	const location = parsed.SaveGame.locations.GameLocation.find(
		(l) => l.name === name,
	);
	if (!location) throw new Error(`No ${name} location`);
	return location;
};

const firstItemWithQuality = (parsed: SaveFile) => {
	const item = parsed.SaveGame.player.items.Item.find(
		(i) => i?.quality !== undefined,
	);
	if (!item) throw new Error("No item with a quality");
	return item;
};

const UNUSUAL_QUALITY =
	"1 item has an unusual quality (not normal, silver, gold or iridium)";

describe("validateSave", () => {
	let fixture: SaveFile;
	// Parsing is slow, so parse once and hand each test its own copy
	const loadParsed = () => structuredClone(fixture);

	beforeAll(async () => {
		fixture = new XMLManager().parse<SaveFile>(
			await readFile("tests/TestSave", "utf-8"),
		);
	});

	it("passes the test save", () => {
		expect(validateSave(loadParsed())).toEqual({
			valid: true,
			errors: [],
			warnings: [],
		});
	});

	it("rejects something that isn't a save", () => {
		const result = validateSave({ notASave: true });
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain("Not a Stardew Valley save");
	});

	it.each([
		[
			"an unsupported game version",
			(p: SaveFile) => {
				p.SaveGame.gameVersion = "1.5.6";
			},
			'Unsupported game version "1.5.6"',
		],
		[
			"a missing unique ID",
			(p: SaveFile) => {
				Reflect.deleteProperty(p.SaveGame, "uniqueIDForThisGame");
			},
			"unique ID",
		],
		[
			"money the game can't read",
			(p: SaveFile) => {
				p.SaveGame.player.money = 2 ** 31;
			},
			"Test's money (2147483648) is out of range",
		],
		[
			"a missing Farm",
			(p: SaveFile) => {
				locationNamed(p, "Farm").name = "Elsewhere";
			},
			"Missing the Farm location",
		],
		[
			"a wrong number of Community Center rooms",
			(p: SaveFile) => {
				locationNamed(p, "CommunityCenter").areasComplete?.boolean.push(
					false,
					false,
				);
			},
			"8 rooms recorded",
		],
		[
			"a reward waiting for the Missing Bundle",
			(p: SaveFile) => {
				const reward = locationNamed(
					p,
					"CommunityCenter",
				).bundleRewards?.item.find((kv) => kv.key.int === 36);
				if (!reward) throw new Error("No reward entry for bundle 36");
				reward.value.boolean = true;
			},
			"Missing Bundle",
		],
		[
			"an item quality the game can't read",
			(p: SaveFile) => {
				firstItemWithQuality(p).quality = "high" as unknown as number;
			},
			"1 item has a quality the game can't read",
		],
	])("rejects %s", (_, breakIt, message) => {
		const parsed = loadParsed();
		breakIt(parsed);
		const result = validateSave(parsed);
		expect(result.valid).toBe(false);
		expect(result.errors.join("\n")).toContain(message);
	});

	it.each([
		[
			"a farm with no name",
			(p: SaveFile) => {
				p.SaveGame.player.farmName = "";
			},
			"The farm has no name",
		],
		[
			"a main player with no name",
			(p: SaveFile) => {
				p.SaveGame.player.name = "";
			},
			"The main player has no name",
		],
		[
			"negative money",
			(p: SaveFile) => {
				p.SaveGame.player.money = -5;
			},
			"Test's money (-5) is negative",
		],
		[
			"an unusual item quality",
			(p: SaveFile) => {
				firstItemWithQuality(p).quality = 3;
			},
			UNUSUAL_QUALITY,
		],
		[
			"an unusual quality on an ordinary item with ID 126 (Strange Doll)",
			(p: SaveFile) => {
				Object.assign(firstItemWithQuality(p), { itemId: 126, quality: 5 });
			},
			UNUSUAL_QUALITY,
		],
	])("only warns about %s", (_, breakIt, message) => {
		const parsed = loadParsed();
		breakIt(parsed);
		const result = validateSave(parsed);
		expect(result.valid).toBe(true);
		expect(result.warnings).toContain(message);
	});

	it("accepts a Rarecrow wearing a hat, which keeps the hat in its quality", () => {
		const parsed = loadParsed();
		const placed = locationNamed(parsed, "Farm").objects?.item[0]?.value.Object;
		if (!placed) throw new Error("Nothing placed on the Farm");
		// (BC)126 wearing hat 4
		Object.assign(placed, {
			name: "Rarecrow",
			itemId: 126,
			bigCraftable: true,
			quality: 5,
		});
		expect(validateSave(parsed)).toEqual({
			valid: true,
			errors: [],
			warnings: [],
		});
	});

	it("accepts a restored Abandoned Joja Mart (7 rooms)", () => {
		const parsed = loadParsed();
		locationNamed(parsed, "CommunityCenter").areasComplete?.boolean.push(true);
		expect(validateSave(parsed).valid).toBe(true);
	});

	it("accepts unclaimed cabins, whose farmhands have no name", () => {
		const parsed = loadParsed();
		const unclaimed = { ...structuredClone(parsed.SaveGame.player), name: "" };
		parsed.SaveGame.farmhands = { Farmer: [unclaimed] };
		expect(validateSave(parsed)).toEqual({
			valid: true,
			errors: [],
			warnings: [],
		});
	});

	it("summarises the first problems", () => {
		expect(
			describeProblems({ valid: false, errors: ["a", "b", "c"], warnings: [] }),
		).toBe("a; b (and 1 more)");
	});
});

async function importSave(xml: string): Promise<SaveManager> {
	let saveManager!: SaveManager;
	let promise: Promise<void> = Promise.resolve();
	const cleanup = $effect.root(() => {
		saveManager = new SaveManager();
		promise = saveManager.import(new File([xml], "TestSave"));
	});
	await promise;
	flushSync();
	cleanup();
	return saveManager;
}

describe("SaveManager validation", () => {
	mockIDB();
	let saveManager: SaveManager;

	beforeEach(async () => {
		saveManager = await importSave(await readFile("tests/TestSave", "utf-8"));
	});

	it("validates a save when it's uploaded", () => {
		expect(saveManager.loadValidation).toEqual({
			valid: true,
			errors: [],
			warnings: [],
		});
	});

	it("validates exactly what would be downloaded", async () => {
		const { blob, validation } = await saveManager.validatedExport();
		expect(blob.size).toBeGreaterThan(0);
		expect(validation.valid).toBe(true);
	});

	it("refuses to download a save that fails validation", async () => {
		const save = saveManager.save;
		if (!save) throw new Error("No save");
		save[Raw].SaveGame.player.money = 2 ** 31;

		const error = await saveManager.download().catch((e) => e);
		expect(error).toBeInstanceOf(SaveValidationError);
		expect(error.message).toBe(
			"Save file is not valid: Test's money (2147483648) is out of range",
		);
	});
});

describe("SaveManager validation of an invalid upload", () => {
	mockIDB();
	let saveManager: SaveManager;

	beforeEach(async () => {
		const xml = (await readFile("tests/TestSave", "utf-8")).replace(
			"<money>1285</money>",
			"<money>99999999999</money>",
		);
		saveManager = await importSave(xml);
	});

	it("still opens the save, so it can be fixed", () => {
		expect(saveManager.save).toBeDefined();
		expect(saveManager.loadValidation?.valid).toBe(false);
		expect(saveManager.loadValidation?.errors).toContain(
			"Test's money (99999999999) is out of range",
		);
	});
});
