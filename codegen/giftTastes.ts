import { ObjectCategory } from "./items.js";

/** The tastes `NPC.getGiftTasteForThisItem` returns, with the game's values */
export const GiftTaste = {
	Love: 0,
	Like: 2,
	Dislike: 4,
	Hate: 6,
	/** Stardrop Tea has a reaction of its own, even better than a loved gift */
	StardropTea: 7,
	Neutral: 8,
} as const;
export type GiftTaste = (typeof GiftTaste)[keyof typeof GiftTaste];

/**
 * Reference IDs for each taste, as listed in `Data/NPCGiftTastes`: item IDs,
 * category numbers (negative) and context tags
 */
export interface TasteLists {
	love: string[];
	like: string[];
	dislike: string[];
	hate: string[];
	neutral: string[];
}

/** `Data/NPCGiftTastes`, split into lists */
export interface GiftTastes {
	universal: TasteLists;
	villagers: ReadonlyMap<string, TasteLists>;
}

/** The parts of an item that a gift taste depends on */
export interface GiftItem {
	/** Qualified item ID, e.g. `(O)74` for Prismatic Shard */
	id: string;
	category: number;
	/** Object type, e.g. `Arch` for artifacts */
	type: string;
	edibility: number;
	price: number;
	contextTags: readonly string[];
}

/** Turns a reference ID into the qualified item ID it means, or undefined if it isn't an item */
export type QualifyItemId = (id: string) => string | undefined;

// ArgUtility.SplitBySpace, also allowing the line breaks the game accepts
const splitIds = (text: string | undefined) =>
	text?.split(/\s+/).filter(Boolean) ?? [];

/** Read `Data/NPCGiftTastes` (`content/Data/NPCGiftTastes.json`) */
export function parseGiftTastes(raw: Record<string, string>): GiftTastes {
	const villagers = new Map<string, TasteLists>();
	for (const [name, value] of Object.entries(raw)) {
		if (name.startsWith("Universal_")) continue;
		// Reaction dialogue and reference IDs alternate: love, like, dislike, hate, neutral
		const fields = value.split("/");
		villagers.set(name, {
			love: splitIds(fields[1]),
			like: splitIds(fields[3]),
			dislike: splitIds(fields[5]),
			hate: splitIds(fields[7]),
			neutral: splitIds(fields[9]),
		});
	}
	return {
		universal: {
			love: splitIds(raw.Universal_Love),
			like: splitIds(raw.Universal_Like),
			dislike: splitIds(raw.Universal_Dislike),
			hate: splitIds(raw.Universal_Hate),
			neutral: splitIds(raw.Universal_Neutral),
		},
		villagers,
	};
}

type TasteName = keyof TasteLists;

/** NPC.CheckTaste: the entry is the item's ID (categories start with "-") */
const isItemId = (entry: string, item: GiftItem, qualify: QualifyItemId) =>
	!entry.startsWith("-") && qualify(entry) === item.id;

/** NPC.CheckTasteContextTags: entries that don't start with a digit or "-" are context tags */
const isContextTag = (entry: string, item: GiftItem) =>
	/^[^\d-]/.test(entry) && item.contextTags.includes(entry);

// The order the game checks the lists in: a love beats a hate, which beats a like...
const universalOrder = ["love", "hate", "like", "dislike"] as const;
const personalOrder = [...universalOrder, "neutral"] as const;

/**
 * A port of `NPC.getGiftTasteForThisItem` (Stardew Valley 1.6) for an object
 * or trinket. Stardrop Tea gets a reaction of its own; otherwise each step
 * overrides the one before it:
 *
 * 1. Universal tastes by category, then by context tag, then by item ID.
 * 2. Artifacts (type `Arch`) are disliked, except by Penny and the Dwarf, who like them.
 * 3. A neutral item that isn't a universal neutral by ID is hated if it's bad
 *    food (negative edibility other than -300, "inedible"), or else disliked
 *    if its price is under 20g.
 * 4. The villager's own tastes by item ID, then by context tag, then by
 *    category; a personal category only counts if the item isn't listed by ID in a
 *    universal taste (so the Universal_Love Magic Rock Candy stays loved by Leo,
 *    who dislikes cooking).
 */
export function getGiftTaste(
	tastes: GiftTastes,
	villager: string,
	item: GiftItem,
	qualify: QualifyItemId,
): GiftTaste {
	if (item.id === "(O)StardropTea") return GiftTaste.StardropTea;

	const category = String(item.category);
	const hasId = (list: readonly string[]) =>
		list.some((entry) => isItemId(entry, item, qualify));
	const hasTag = (list: readonly string[]) =>
		list.some((entry) => isContextTag(entry, item));
	const pick = (
		order: readonly TasteName[],
		lists: TasteLists,
		matches: (list: readonly string[]) => boolean,
	) => order.find((taste) => matches(lists[taste]));
	const value = (taste: TasteName) =>
		({
			love: GiftTaste.Love,
			like: GiftTaste.Like,
			dislike: GiftTaste.Dislike,
			hate: GiftTaste.Hate,
			neutral: GiftTaste.Neutral,
		})[taste];

	const { universal } = tastes;
	let taste: GiftTaste = GiftTaste.Neutral;
	// The category is compared as text with every entry, so category 0 matches
	// the "0" (Weeds) in Universal_Hate
	const byCategory = pick(universalOrder, universal, (list) =>
		list.includes(category),
	);
	if (byCategory) taste = value(byCategory);
	const byTag = pick(universalOrder, universal, hasTag);
	if (byTag) taste = value(byTag);
	const byId = pick(personalOrder, universal, hasId);
	if (byId) taste = value(byId);

	if (item.type === "Arch") {
		taste =
			villager === "Penny" || villager === "Dwarf"
				? GiftTaste.Like
				: GiftTaste.Dislike;
	}

	if (taste === GiftTaste.Neutral && byId !== "neutral") {
		if (item.edibility !== -300 && item.edibility < 0) {
			taste = GiftTaste.Hate;
		} else if (item.price < 20) {
			taste = GiftTaste.Dislike;
		}
	}

	const personal = tastes.villagers.get(villager);
	if (personal) {
		const own =
			pick(personalOrder, personal, hasId) ??
			pick(personalOrder, personal, hasTag) ??
			(byId === undefined && item.category !== 0
				? pick(personalOrder, personal, (list) => list.includes(category))
				: undefined);
		if (own) return value(own);
	}
	return taste;
}

/** The fields of a generated/iteminfo.json entry used here */
export interface ItemInfo {
	_type: string;
	_key: string;
	name: string;
	category?: number;
	type?: string;
	edibility?: number;
	price?: number;
	tags?: string[];
	unpreservedItemId?: string;
}

export interface LovedGift {
	/** Name to show */
	name: string;
	/** Key in generated/iteminfo.json, for `Item.fromName` */
	item: string;
	/** For a category or context tag that covers many items: the name of every item in it */
	items?: string[];
}

export interface VillagerGifts {
	/** Gifts the villager loves because of their own tastes */
	loves: LovedGift[];
	/** Universal loves the villager doesn't override with a taste of their own */
	universalLoves: LovedGift[];
}

/** A personal love that covers more items than this is shown once, as a group */
export const groupAbove = 5;

/**
 * These are never received as normal gifts: `NPC.tryToReceiveActiveObject`
 * handles them first (Pierre's Missing Stocklist, Movie Ticket, Bouquet,
 * Wilted Bouquet and Mermaid's Pendant)
 */
const notGifts = new Set(["(O)897", "(O)809", "(O)458", "(O)277", "(O)460"]);

/** "FrogEgg" -> "Frog Egg", "book_item" -> "book item" */
const words = (name: string) =>
	name.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ");

const byName = (a: LovedGift, b: LovedGift) =>
	a.name.localeCompare(b.name, "en");

/**
 * Work out which items each villager loves, applying `getGiftTaste` to every
 * object and trinket in generated/iteminfo.json that can be given as a gift.
 *
 * @param raw `Data/NPCGiftTastes`
 * @param itemInfo The entries of generated/iteminfo.json
 * @param villagers The villagers to include
 * @returns Each villager's loved gifts, plus any loved item ID, category or
 * context tag that matched no giftable item (so new game data doesn't silently
 * go missing)
 */
export function villagerGifts(
	raw: Record<string, string>,
	itemInfo: readonly (readonly [string, ItemInfo])[],
	villagers: readonly string[],
) {
	const tastes = parseGiftTastes(raw);

	// ItemRegistry.GetData resolves an unqualified ID to an object first
	const objectIds = new Set<string>();
	const trinketIds = new Set<string>();
	for (const [, info] of itemInfo) {
		if (info._type === "Object") objectIds.add(info._key);
		if (info._type === "Trinket") trinketIds.add(info._key);
	}
	const qualify: QualifyItemId = (id) => {
		if (id.startsWith("(")) return id;
		if (objectIds.has(id)) return `(O)${id}`;
		if (trinketIds.has(id)) return `(TR)${id}`;
		return undefined;
	};

	// Objects (not big craftables or furniture) and trinkets can be gifted. Rings
	// are created as a separate item class, not as objects, so they can't be.
	// Flavoured variants such as Blueberry Wine share their product's ID and get
	// the same reaction, so each product is checked once, from its base item.
	const gifts: { name: string; gift: GiftItem }[] = [];
	for (const [name, info] of itemInfo) {
		if (info._type === "Object") {
			if (info.unpreservedItemId || info.type === "Ring") continue;
			if (info.tags?.includes("not_giftable")) continue;
			const id = `(O)${info._key}`;
			if (notGifts.has(id)) continue;
			gifts.push({
				name,
				gift: {
					id,
					category: info.category ?? 0,
					type: info.type ?? "",
					edibility: info.edibility ?? -300,
					price: info.price ?? 0,
					contextTags: info.tags ?? [],
				},
			});
		} else if (info._type === "Trinket") {
			gifts.push({
				name,
				gift: {
					id: `(TR)${info._key}`,
					category: ObjectCategory.Trinket,
					type: "",
					edibility: -300,
					price: info.price ?? 0,
					// The game tags each item with its category; this is the only such
					// tag the gift tastes use
					contextTags: ["category_trinket"],
				},
			});
		}
	}

	const universalOnly: GiftTastes = {
		universal: tastes.universal,
		villagers: new Map(),
	};
	const result: Record<string, VillagerGifts> = {};
	for (const villager of villagers) {
		const lists = tastes.villagers.get(villager);
		// NPC.CanReceiveGifts: villagers without gift tastes can't be given gifts
		if (!lists) {
			result[villager] = { loves: [], universalLoves: [] };
			continue;
		}
		const universalLoves = new Map<string, LovedGift>();
		// Personal loves, by the love-list entry that matched
		const byEntry = new Map<string, { name: string; item: string }[]>();
		for (const { name, gift } of gifts) {
			const taste = getGiftTaste(tastes, villager, gift, qualify);
			// Stardrop Tea's reaction beats a loved gift's, and no one's own tastes
			// can change it, so it's listed with the universal loves
			if (taste === GiftTaste.StardropTea) {
				universalLoves.set(name, { name: words(name), item: name });
				continue;
			}
			if (taste !== GiftTaste.Love) continue;
			// Loved even without the villager's own tastes
			if (
				getGiftTaste(universalOnly, villager, gift, qualify) === GiftTaste.Love
			) {
				universalLoves.set(name, { name: words(name), item: name });
				continue;
			}
			// Same order as getGiftTaste: item ID, then context tag, then category
			const entry =
				lists.love.find((id) => isItemId(id, gift, qualify)) ??
				lists.love.find((tag) => isContextTag(tag, gift)) ??
				String(gift.category);
			const items = byEntry.get(entry) ?? [];
			// Items with the same name (both Strange Dolls) are shown once
			if (!items.some((other) => other.item === name)) {
				items.push({ name: words(name), item: name });
			}
			byEntry.set(entry, items);
		}

		const loves: LovedGift[] = [];
		const groups: LovedGift[] = [];
		for (const [entry, items] of byEntry) {
			items.sort(byName);
			const first = items[0];
			if (first && items.length > groupAbove) {
				// e.g. Penny's "book_item" covers every book: show "Any book" once
				const category = ObjectCategory[Number(entry)];
				groups.push({
					name: `Any ${
						entry.startsWith("-")
							? words(category ?? entry).toLowerCase()
							: words(entry.replace(/_item$/, ""))
					}`,
					item: first.item,
					items: items.map((gift) => gift.name),
				});
			} else {
				for (const gift of items) {
					if (!loves.some((other) => other.item === gift.item)) {
						loves.push(gift);
					}
				}
			}
		}
		result[villager] = {
			loves: [...loves.sort(byName), ...groups.sort(byName)],
			universalLoves: [...universalLoves.values()].sort(byName),
		};
	}

	const unmatched = [
		...new Set([
			...tastes.universal.love,
			...[...tastes.villagers]
				.filter(([villager]) => villagers.includes(villager))
				.flatMap(([, lists]) => lists.love),
		]),
	].filter(
		(entry) =>
			!gifts.some(
				({ gift }) =>
					(entry.startsWith("-") && String(gift.category) === entry) ||
					isItemId(entry, gift, qualify) ||
					isContextTag(entry, gift),
			),
	);

	return { villagers: result, unmatched };
}
