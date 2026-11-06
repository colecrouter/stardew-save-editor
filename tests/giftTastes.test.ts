import { describe, expect, it } from "vitest";
import {
	type GiftItem,
	GiftTaste,
	getGiftTaste,
	type ItemInfo,
	parseGiftTastes,
	villagerGifts,
} from "../codegen/giftTastes";

// A cut-down Data/NPCGiftTastes: reaction dialogue and reference IDs alternate
// (love, like, dislike, hate, neutral)
const raw = {
	Universal_Love: "74 446 279 373",
	Universal_Like: "-2 -7",
	Universal_Neutral: "194 book_item",
	Universal_Dislike: "-4 category_trinket",
	Universal_Hate: "0 -20 93",
	Abigail: "Love!/66 Book_Void/Like/-6/Dislike/-5 16/Hate/330/Thanks//",
	Haley: "Love!/221/Like/18/Dislike/-75/Hate/-4 74/Thanks//",
	Penny: "Love!/72 book_item/Like/ancient_item/Dislike/80/Hate/446/Thanks//",
	Leo: "Love!/ParrotEgg/Like/852/Dislike/-7 -81/Hate/257/Thanks//",
	Linus: "Love!/88/Like/-5/Dislike/-2 194 373/Hate//Neutral/-4/",
	Pam: "Love!/-6 0/Like//Dislike//Hate//Thanks/-2/",
};
const tastes = parseGiftTastes(raw);
const qualify = (id: string) => (id.startsWith("(") ? id : `(O)${id}`);

const object = (id: string, fields: Partial<GiftItem> = {}): GiftItem => ({
	id: `(O)${id}`,
	category: 0,
	type: "Basic",
	edibility: -300,
	price: 100,
	contextTags: [],
	...fields,
});
const amethyst = object("66", { category: -2, type: "Minerals" });
const prismaticShard = object("74", { category: -2, type: "Minerals" });
const rabbitsFoot = object("446", { category: -18 });
const magicRockCandy = object("279", { category: -7, type: "Cooking" });
const milk = object("184", { category: -6 });
const largeMilk = object("186", { category: -6 });
const sardine = object("131", { category: -4, type: "Fish" });
const book = object("Book_Void", {
	category: -102,
	contextTags: ["book_item"],
});
const strangeDoll = object("126", { type: "Arch", contextTags: ["doll_item"] });
const tasteFor = (villager: string, item: GiftItem) =>
	getGiftTaste(tastes, villager, item, qualify);

describe("NPCGiftTastes parsing", () => {
	it("splits universal and personal lists", () => {
		expect(tastes.universal.love).toEqual(["74", "446", "279", "373"]);
		expect(tastes.villagers.get("Abigail")).toEqual({
			love: ["66", "Book_Void"],
			like: ["-6"],
			dislike: ["-5", "16"],
			hate: ["330"],
			neutral: [],
		});
		expect(tastes.villagers.has("Universal_Love")).toBe(false);
	});

	it("allows line breaks next to the delimiters", () => {
		expect(
			parseGiftTastes({ Sam: "Love!/\n90 206\n/Like/167/\n" }).villagers.get(
				"Sam",
			)?.love,
		).toEqual(["90", "206"]);
	});
});

describe("getGiftTaste (NPC.getGiftTasteForThisItem)", () => {
	it("loves a personal item by ID", () => {
		// ...over the universal like for gems, which is all Haley has
		expect(tasteFor("Abigail", amethyst)).toBe(GiftTaste.Love);
		expect(tasteFor("Haley", amethyst)).toBe(GiftTaste.Like);
	});

	it("loves a personal category", () => {
		expect(tasteFor("Pam", milk)).toBe(GiftTaste.Love);
		expect(tasteFor("Pam", largeMilk)).toBe(GiftTaste.Love);
		expect(tasteFor("Abigail", milk)).toBe(GiftTaste.Like);
	});

	it("lets a personal category override a universal one", () => {
		expect(tasteFor("Abigail", sardine)).toBe(GiftTaste.Dislike);
		expect(tasteFor("Haley", sardine)).toBe(GiftTaste.Hate);
		expect(tasteFor("Linus", sardine)).toBe(GiftTaste.Neutral);
	});

	it("loves a personal context tag", () => {
		expect(tasteFor("Penny", book)).toBe(GiftTaste.Love);
		// ...even if the item's ID is listed as a universal taste
		expect(
			tasteFor("Penny", object("194", { contextTags: ["book_item"] })),
		).toBe(GiftTaste.Love);
	});

	it("loves universal loves", () => {
		expect(tasteFor("Abigail", prismaticShard)).toBe(GiftTaste.Love);
		expect(tasteFor("Abigail", rabbitsFoot)).toBe(GiftTaste.Love);
	});

	it("lets a personal hate or dislike override a universal love", () => {
		expect(tasteFor("Haley", prismaticShard)).toBe(GiftTaste.Hate);
		expect(tasteFor("Penny", rabbitsFoot)).toBe(GiftTaste.Hate);
		expect(tasteFor("Linus", object("373"))).toBe(GiftTaste.Dislike);
		expect(tasteFor("Abigail", object("373"))).toBe(GiftTaste.Love);
	});

	it("ignores a personal category for items listed by ID in a universal taste", () => {
		// Leo dislikes cooking, but Magic Rock Candy is a Universal_Love by ID
		expect(tasteFor("Leo", magicRockCandy)).toBe(GiftTaste.Love);
		expect(tasteFor("Leo", object("194", { category: -7 }))).toBe(
			GiftTaste.Neutral,
		);
		// Other cooking isn't listed by ID, so Leo's category dislike counts
		expect(tasteFor("Leo", object("195", { category: -7 }))).toBe(
			GiftTaste.Dislike,
		);
		// A personal ID still counts: Linus dislikes the universally neutral 194
		expect(tasteFor("Linus", object("194"))).toBe(GiftTaste.Dislike);
		expect(tasteFor("Abigail", object("194"))).toBe(GiftTaste.Neutral);
	});

	it("checks universal categories, then context tags, then IDs", () => {
		expect(tasteFor("Abigail", object("60", { category: -2 }))).toBe(
			GiftTaste.Like,
		);
		// Universal_Dislike by context tag beats Universal_Like by category
		expect(
			tasteFor(
				"Abigail",
				object("61", { category: -2, contextTags: ["category_trinket"] }),
			),
		).toBe(GiftTaste.Dislike);
		// Universal_Hate by ID beats them both
		expect(
			tasteFor(
				"Abigail",
				object("93", { category: -2, contextTags: ["category_trinket"] }),
			),
		).toBe(GiftTaste.Hate);
		// Universal neutrals aren't checked by context tag, so a cheap book is
		// disliked, while a cheap Universal_Neutral by ID stays neutral
		const cheapBook = { category: -102, price: 10, contextTags: ["book_item"] };
		expect(tasteFor("Abigail", object("102", cheapBook))).toBe(
			GiftTaste.Dislike,
		);
		expect(tasteFor("Abigail", object("194", cheapBook))).toBe(
			GiftTaste.Neutral,
		);
	});

	it("matches category 0 against the 0 (Weeds) in Universal_Hate", () => {
		expect(tasteFor("Abigail", object("797"))).toBe(GiftTaste.Hate);
		// Personal categories never match category 0: Pam's "0" is only Weeds
		expect(tasteFor("Pam", object("797"))).toBe(GiftTaste.Hate);
		expect(tasteFor("Pam", object("0", { category: -999 }))).toBe(
			GiftTaste.Love,
		);
	});

	it("makes artifacts disliked, except by Penny and the Dwarf", () => {
		const artifact = object("100", { category: 0, type: "Arch" });
		expect(tasteFor("Abigail", artifact)).toBe(GiftTaste.Dislike);
		expect(tasteFor("Penny", artifact)).toBe(GiftTaste.Like);
		expect(tasteFor("Dwarf", artifact)).toBe(GiftTaste.Like);
		// Personal tastes still apply, like Jas's love for dolls
		expect(
			getGiftTaste(
				parseGiftTastes({
					...raw,
					Jas: "Love!/doll_item/Like//Dislike//Hate//Thanks//",
				}),
				"Jas",
				strangeDoll,
				qualify,
			),
		).toBe(GiftTaste.Love);
	});

	it("hates bad food and dislikes cheap items left neutral", () => {
		expect(
			tasteFor("Abigail", object("500", { edibility: -20, category: -81 })),
		).toBe(GiftTaste.Hate);
		expect(
			tasteFor("Abigail", object("501", { price: 10, category: -81 })),
		).toBe(GiftTaste.Dislike);
		// Unless the item is a Universal_Neutral
		expect(
			tasteFor("Abigail", object("194", { price: 10, category: -81 })),
		).toBe(GiftTaste.Neutral);
	});

	it("gives Stardrop Tea its own reaction, not a love", () => {
		expect(tasteFor("Abigail", object("StardropTea"))).toBe(
			GiftTaste.StardropTea,
		);
	});
});

describe("villagerGifts", () => {
	const info = (
		_key: string,
		name: string,
		fields: Partial<ItemInfo> = {},
	): [string, ItemInfo] => [
		name,
		{ _type: "Object", _key, name, type: "Basic", price: 100, ...fields },
	];
	const books = Array.from({ length: 6 }, (_, i) =>
		info(`Book_${i}`, `Book ${6 - i}`, {
			category: -102,
			tags: ["book_item"],
		}),
	);
	const items = [
		info("66", "Amethyst", { category: -2 }),
		info("72", "Diamond", { category: -2 }),
		info("373", "Golden Pumpkin"),
		info("74", "Prismatic Shard", { category: -2 }),
		info("446", "Rabbit's Foot", { category: -18 }),
		info("279", "Magic Rock Candy", { category: -7 }),
		info("88", "Coconut", { category: -79 }),
		info("348", "Wine", { category: -26 }),
		info("348", "Blueberry Wine", { category: -26, unpreservedItemId: "258" }),
		info("458", "Bouquet"),
		info("StardropTea", "Stardrop Tea"),
		info("529", "Amethyst Ring", { type: "Ring", category: -96 }),
		info("Book_Void", "Monster Compendium", {
			category: -102,
			tags: ["book_item"],
		}),
		...books,
		[
			"ParrotEgg",
			{ _type: "Trinket", _key: "ParrotEgg", name: "ParrotEgg" },
		] as [string, ItemInfo],
		// Only objects and trinkets can be gifted
		[
			"Big Craftable 74",
			{ _type: "BigCraftable", _key: "74", name: "Big Craftable 74" },
		] as [string, ItemInfo],
	];
	const { villagers, unmatched } = villagerGifts(
		{
			...raw,
			Leah: "Love!/348 458 529 999/Like//Dislike//Hate//Thanks//",
		},
		items,
		["Abigail", "Haley", "Penny", "Leo", "Leah", "Krobus"],
	);
	const names = (gifts: { name: string }[] | undefined) =>
		gifts?.map((gift) => gift.name);

	it("lists personal loves, sorted, with item keys for the sprites", () => {
		expect(villagers.Abigail?.loves).toEqual([
			{ name: "Amethyst", item: "Amethyst" },
			{ name: "Monster Compendium", item: "Monster Compendium" },
		]);
		// Trinkets get a readable name
		expect(villagers.Leo?.loves).toEqual([
			{ name: "Parrot Egg", item: "ParrotEgg" },
		]);
	});

	it("lists the universal loves each villager doesn't override", () => {
		expect(names(villagers.Abigail?.universalLoves)).toEqual([
			"Golden Pumpkin",
			"Magic Rock Candy",
			"Prismatic Shard",
			"Rabbit's Foot",
			"Stardrop Tea",
		]);
		// Haley hates Prismatic Shard and Penny hates Rabbit's Foot
		expect(names(villagers.Haley?.universalLoves)).toEqual([
			"Golden Pumpkin",
			"Magic Rock Candy",
			"Rabbit's Foot",
			"Stardrop Tea",
		]);
		expect(names(villagers.Penny?.universalLoves)).toEqual([
			"Golden Pumpkin",
			"Magic Rock Candy",
			"Prismatic Shard",
			"Stardrop Tea",
		]);
		expect(names(villagers.Leo?.universalLoves)).toContain("Magic Rock Candy");
	});

	it("shows a love that covers many items once, as a group", () => {
		expect(villagers.Penny?.loves).toEqual([
			{ name: "Diamond", item: "Diamond" },
			{
				name: "Any book",
				item: "Book 1",
				items: [
					"Book 1",
					"Book 2",
					"Book 3",
					"Book 4",
					"Book 5",
					"Book 6",
					"Monster Compendium",
				],
			},
		]);
	});

	it("checks each product once, skipping items that can't be gifted", () => {
		// Wine, not every flavour of it; the Bouquet and rings aren't gifts
		expect(villagers.Leah?.loves).toEqual([{ name: "Wine", item: "Wine" }]);
	});

	it("gives nothing to villagers without gift tastes", () => {
		expect(villagers.Krobus).toEqual({ loves: [], universalLoves: [] });
	});

	it("reports loved entries that match no giftable item", () => {
		expect(unmatched.sort()).toEqual(["221", "458", "529", "999"]);
	});
});
