import { expect, it } from "vitest";
import { tinyEditorFixture } from "../helpers/editor-document.ts";
import { extraAchievementDiagnostics } from "../../src/lib/editor/achievement-diagnostics.ts";
import cropRequirements from "../../generated/achievement-requirements.json";

function fixture() {
	const document = tinyEditorFixture();
	document.SaveGame.farmhands = [];
	Object.assign(document.SaveGame.player, {
		basicShipped: [],
		stats: { Values: [] },
		achievements: [],
		mailReceived: [],
		mailForTomorrow: [],
		mailbox: [],
		lastSeenMovieWeek: -1,
	});
	return document;
}

it("counts shared museum donations rather than discoveries and rejects ambiguous placements", () => {
	const document = fixture();
	const pieces = Array.from({ length: 40 }, (_, index) => ({
		key: { X: index, Y: 1 },
		value: String(index),
	}));
	document.SaveGame.locations!.push({
		$type: "StardewValley.Locations.LibraryMuseum",
		name: "ArchaeologyHouse",
		museumPieces: pieces,
	});
	const host = document.SaveGame.player;
	host.archaeologyFound = [{ key: "MissingDonation", value: [99, 0] }];
	const diagnostics = () => extraAchievementDiagnostics(document, host);
	expect(diagnostics().get(5)).toMatchObject({ value: 40, target: 95 });
	expect(diagnostics().get(28)).toMatchObject({ value: 40, target: 40 });
	pieces.push({ key: { X: 0, Y: 1 }, value: "another" });
	expect(diagnostics().get(28)?.value).toBeUndefined();
});

it("uses crop-specific membership and quantity boundaries for shipping achievements", () => {
	const document = fixture();
	const host = document.SaveGame.player;
	host.basicShipped = cropRequirements.polyculture.map((key) => ({
		key,
		value: 15,
	}));
	const diagnostics = () => extraAchievementDiagnostics(document, host);
	expect(diagnostics().get(31)).toMatchObject({
		value: 28,
		target: 28,
		unknown: 0,
	});
	host.basicShipped[0]!.value = 14;
	expect(diagnostics().get(31)?.value).toBe(27);
	host.basicShipped.push({ key: "unrelated", value: 999 });
	expect(diagnostics().get(32)?.value).toBe(15);
	host.basicShipped.push({
		key: cropRequirements.monoculture.find(
			(key) => !cropRequirements.polyculture.includes(key),
		)!,
		value: 300,
	});
	expect(diagnostics().get(32)).toMatchObject({ value: 300, target: 300 });
	host.basicShipped.push({ ...host.basicShipped[0]! });
	expect(diagnostics().get(31)?.unknown).toBe(1);
});

it("counts only the nineteen named power books and keeps duplicate stat keys uncertain", () => {
	const document = fixture();
	const host = document.SaveGame.player;
	const books = [
		"Trash",
		"Crabbing",
		"Bombs",
		"Roe",
		"WildSeeds",
		"Woodcutting",
		"Defense",
		"Friendship",
		"Void",
		"Speed",
		"Marlon",
		"PriceCatalogue",
		"Diamonds",
		"Mystery",
		"AnimalCatalogue",
		"Speed2",
		"Artifact",
		"Horse",
		"Grass",
	];
	host.stats = {
		Values: books.map((name) => ({ key: `Book_${name}`, value: 1 })),
	};
	const diagnostics = () => extraAchievementDiagnostics(document, host);
	expect(diagnostics().get(35)).toMatchObject({
		value: 19,
		target: 19,
		unknown: 0,
	});
	host.stats.Values![0]!.value = 0;
	host.stats.Values!.push({ key: "Book_QueenOfSauce", value: 1 });
	expect(diagnostics().get(35)?.value).toBe(18);
	host.stats.Values!.push({ key: "book_trash", value: 1 });
	expect(diagnostics().get(35)?.unknown).toBe(1);
});

it("uses visit and hard-mine flags without substituting access, ordinary depth or another farmer's mail", () => {
	const document = fixture();
	const host = document.SaveGame.player;
	host.deepestMineLevel = 120;
	host.mailReceived = ["Farm_Eternal", "Island_Unlock"];
	const diagnostics = () => extraAchievementDiagnostics(document, host);
	expect(diagnostics().get(40)?.value).toBe(0);
	expect(diagnostics().get(41)?.value).toBe(0);
	expect(diagnostics().get(44)?.value).toBe(0);
	host.mailForTomorrow = [
		"Visited_Island%&NL&%",
		"reachedBottomOfHardMines%&NL&%",
	];
	host.mailReceived.push("Summit_event");
	expect(diagnostics().get(40)?.value).toBe(1);
	expect(diagnostics().get(41)?.value).toBe(1);
	expect(diagnostics().get(44)?.value).toBe(1);
	const guest = structuredClone(host);
	guest.mailReceived = [];
	guest.mailForTomorrow = [];
	guest.mailbox = [];
	expect(extraAchievementDiagnostics(document, guest).get(40)?.value).toBe(0);
});

it("matches the raccoon family growth delay at seven days and accepts the saved finale", () => {
	const document = fixture();
	const host = document.SaveGame.player;
	Object.assign(document.SaveGame, {
		timesFedRaccoons: 9,
		daysPlayedWhenLastRaccoonBundleWasFinished: 0,
		dayOfMonth: 7,
	});
	const diagnostics = () => extraAchievementDiagnostics(document, host);
	expect(diagnostics().get(39)).toMatchObject({ value: 7, target: 8 });
	document.SaveGame.dayOfMonth = 8;
	expect(diagnostics().get(39)?.value).toBe(8);
	delete document.SaveGame.daysPlayedWhenLastRaccoonBundleWasFinished;
	expect(diagnostics().get(39)?.value).toBeUndefined();
	host.mailReceived = ["seenRaccoonFinishEvent"];
	expect(diagnostics().get(39)?.value).toBe(8);
});

it("uses movie history, positive Infinity ownership and explicitly explained historical awards", () => {
	const document = fixture();
	const host = document.SaveGame.player;
	const diagnostics = () => extraAchievementDiagnostics(document, host);
	expect(diagnostics().get(36)?.value).toBe(0);
	host.lastSeenMovieWeek = 0;
	expect(diagnostics().get(36)?.value).toBe(1);
	host.items = [{ $type: "StardewValley.Tools.MeleeWeapon", itemId: "62" }];
	expect(diagnostics().get(42)?.value).toBe(1);
	host.items = [];
	expect(diagnostics().get(42)?.value).toBeUndefined();
	host.festivalScore = 99999;
	expect(diagnostics().get(37)?.value).toBeUndefined();
	expect(diagnostics().get(38)?.evidence).toContain(
		"no independent saved score",
	);
	host.achievements = [37, 38, 42];
	const before = structuredClone(document);
	for (const id of [37, 38, 42])
		expect(diagnostics().get(id)).toMatchObject({ value: 1, target: 1 });
	expect(document).toEqual(before);
});
