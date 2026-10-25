import { readFile } from "node:fs/promises";
import { fireEvent, render } from "@testing-library/svelte";
import { createRawSnippet, flushSync } from "svelte";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setup as mockIDB } from "vitest-indexeddb";
import { Raw } from "$lib/proxies";
import {
	describeProblems,
	describeResult,
	validateSave,
} from "$lib/saveValidation";
import { XMLManager } from "$lib/workers/xml";
import type { Season } from "$types/save";
import {
	SaveManager,
	SaveValidationError,
	setSaveManagerContext,
} from "../src/lib/SaveManager.svelte";
import {
	setToastManagerContext,
	ToastManager,
} from "../src/lib/ToastManager.svelte";
import editLayout from "../src/routes/(edit)/+layout.svelte";
import uploadPage from "../src/routes/(home)/(upload)/+page.svelte";

// The pages navigate after uploading, which isn't possible here
vi.mock("$app/navigation", () => ({ goto: vi.fn() }));

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

const daysPlayedStat = (player: SaveFile["SaveGame"]["player"]) => {
	const stat = player.stats.Values?.item?.find(
		(s) => s.key.string === "daysPlayed",
	);
	if (!stat) throw new Error("No daysPlayed stat");
	return stat;
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
		[
			"a season the game can't read",
			(p: SaveFile) => {
				p.SaveGame.currentSeason = "autumn" as Season;
			},
			"The season (autumn) isn't spring, summer, fall or winter",
		],
		[
			"a missing season",
			(p: SaveFile) => {
				Reflect.deleteProperty(p.SaveGame, "currentSeason");
			},
			"The season (missing) isn't spring, summer, fall or winter",
		],
		[
			"a day of the month the game can't read",
			(p: SaveFile) => {
				p.SaveGame.dayOfMonth = "first" as unknown as number;
			},
			"The day of the month (first) isn't a number the game can read",
		],
		[
			"a year too big for the game's int",
			(p: SaveFile) => {
				p.SaveGame.year = 2 ** 31;
			},
			"The year (2147483648) isn't a number the game can read",
		],
		[
			"a farmhand's stat the game can't read",
			(p: SaveFile) => {
				// An unclaimed cabin's farmhand, whose stats are still read
				const farmhand = { ...structuredClone(p.SaveGame.player), name: "" };
				daysPlayedStat(farmhand).value.unsignedInt = -1;
				p.SaveGame.farmhands = { Farmer: [farmhand] };
			},
			"Farmhand 1's daysPlayed stat (-1) is out of range",
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
		[
			"day 29, a date the game never makes",
			(p: SaveFile) => {
				p.SaveGame.dayOfMonth = 29;
			},
			"The day of the month (29) isn't 1 to 28",
		],
		[
			"day 0, a date the game never makes",
			(p: SaveFile) => {
				p.SaveGame.dayOfMonth = 0;
			},
			"The day of the month (0) isn't 1 to 28",
		],
		[
			"a missing day of the month, which loads as day 0",
			(p: SaveFile) => {
				Reflect.deleteProperty(p.SaveGame, "dayOfMonth");
			},
			"The day of the month (0) isn't 1 to 28",
		],
		[
			"year 0, a date the game never makes",
			(p: SaveFile) => {
				p.SaveGame.year = 0;
			},
			"The year (0) is less than 1",
		],
		[
			"snow outside winter",
			(p: SaveFile) => {
				p.SaveGame.isSnowing = true;
			},
			"It's snowing in spring, and only snows in winter",
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

	it.each([-102, 1.5, 2 ** 32, ""])(
		"rejects a stat of %j, which the game can't read back",
		(value) => {
			const parsed = loadParsed();
			daysPlayedStat(parsed.SaveGame.player).value.unsignedInt =
				value as number;
			const result = validateSave(parsed);
			expect(result.valid).toBe(false);
			expect(result.errors).toEqual([
				`Test's daysPlayed stat (${value}) is out of range`,
			]);
		},
	);

	it("accepts the biggest stat the game can hold", () => {
		const parsed = loadParsed();
		daysPlayedStat(parsed.SaveGame.player).value.unsignedInt = 2 ** 32 - 1;
		expect(validateSave(parsed)).toEqual({
			valid: true,
			errors: [],
			warnings: [],
		});
	});

	it.each(["Summer", " FALL ", 2, "3"])(
		"reads the season %j by name in any case, or by number",
		(season) => {
			const parsed = loadParsed();
			Object.assign(parsed.SaveGame, { currentSeason: season });
			expect(validateSave(parsed)).toEqual({
				valid: true,
				errors: [],
				warnings: [],
			});
		},
	);

	it("accepts snow in winter", () => {
		const parsed = loadParsed();
		Object.assign(parsed.SaveGame, {
			currentSeason: "winter",
			isSnowing: true,
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

	it("summarises problems as the first one and a count of the rest", () => {
		expect(describeProblems(["a"])).toBe("a");
		expect(describeProblems(["a", "b", "c"])).toBe("a (and 2 more)");
	});
});

describe("describeResult", () => {
	const clean = { valid: true, errors: [], warnings: [] };

	it("just says what happened when nothing was found", () => {
		expect(describeResult("uploaded", clean)).toEqual({
			message: "Save file uploaded!",
			type: "success",
			duration: 5000,
		});
		expect(describeResult("downloaded", clean).message).toBe(
			"Save file downloaded!",
		);
	});

	it("shows a warning", () => {
		expect(
			describeResult("downloaded", { ...clean, warnings: ["Low money"] }),
		).toEqual({
			message: "Save file downloaded, with a warning: Low money",
			type: "warning",
			duration: 10000,
		});
	});

	it("summarises several warnings", () => {
		expect(
			describeResult("uploaded", { ...clean, warnings: ["a", "b", "c"] })
				.message,
		).toBe("Save file uploaded, with warnings: a (and 2 more)");
	});

	it("puts errors first, and counts the warnings after them", () => {
		expect(
			describeResult("uploaded", {
				valid: false,
				errors: ["Broken"],
				warnings: ["Odd"],
			}),
		).toEqual({
			message: "Save file uploaded, but it has problems: Broken (and 1 more)",
			type: "failure",
			duration: 10000,
		});
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
			"Save file not downloaded: Test's money (2147483648) is out of range",
		);
	});

	it("still downloads a save with warnings, and returns them", async () => {
		const click = vi
			.spyOn(HTMLAnchorElement.prototype, "click")
			.mockImplementation(() => {});
		const save = saveManager.save;
		if (!save) throw new Error("No save");
		save[Raw].SaveGame.player.money = -5;

		const validation = await saveManager.download();
		expect(click).toHaveBeenCalledOnce();
		expect(validation.warnings).toEqual(["Test's money (-5) is negative"]);
		click.mockRestore();
	});
});

describe("Validation toasts", () => {
	mockIDB();
	const negativeMoneySave = async () =>
		(await readFile("tests/TestSave", "utf-8")).replace(
			"<money>1285</money>",
			"<money>-5</money>",
		);

	// Contexts for the pages, with a spy on the toasts they add
	const contexts = (saveManager: SaveManager) => {
		const toastManager = new ToastManager();
		const add = vi.spyOn(toastManager, "add");
		const context = new Map<unknown, unknown>([
			...setSaveManagerContext(saveManager),
			...setToastManagerContext(toastManager),
		]);
		return { context, add };
	};

	it("shows warnings when a save is uploaded", async () => {
		let saveManager!: SaveManager;
		const cleanup = $effect.root(() => {
			saveManager = new SaveManager();
		});
		const { context, add } = contexts(saveManager);
		const page = render(uploadPage, { context });

		const input =
			page.container.querySelector<HTMLInputElement>('input[type="file"]');
		if (!input) throw new Error("No file input");
		// happy-dom's FileList is an array
		const files = new FileList();
		(files as unknown as File[]).push(
			new File([await negativeMoneySave()], "TestSave"),
		);
		input.files = files;
		await fireEvent.change(input);

		await vi.waitFor(() => expect(add).toHaveBeenCalled(), { timeout: 30000 });
		const [toast, duration] = add.mock.calls[0] ?? [];
		expect(toast?.message).toBe(
			"Save file uploaded, with a warning: Test's money (-5) is negative",
		);
		expect(toast?.icon).toBe("⚠️");
		expect(duration).toBe(10000);
		cleanup();
	});

	it("shows warnings when a save is downloaded, and still downloads it", async () => {
		const click = vi
			.spyOn(HTMLAnchorElement.prototype, "click")
			.mockImplementation(() => {});
		const saveManager = await importSave(await negativeMoneySave());
		const { context, add } = contexts(saveManager);
		const children = createRawSnippet(() => ({ render: () => "<div></div>" }));
		const page = render(editLayout, { props: { children }, context });

		await fireEvent.click(page.getByTestId("save-button"));

		await vi.waitFor(() => expect(add).toHaveBeenCalled(), { timeout: 30000 });
		expect(click).toHaveBeenCalledOnce();
		const [toast] = add.mock.calls[0] ?? [];
		expect(toast?.message).toBe(
			"Save file downloaded, with a warning: Test's money (-5) is negative",
		);
		expect(toast?.icon).toBe("⚠️");
		click.mockRestore();
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
