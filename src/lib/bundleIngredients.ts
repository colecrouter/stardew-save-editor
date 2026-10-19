import { CategoriesWithQuality, ObjectData } from "$lib/ItemData";
import { ObjectCategory, type RegularObject } from "$types/items";

/*
	What a Community Center bundle can ask for. Each ingredient in a bundle's
	data is "<id> <stack> <minimum quality>" (BundleIngredientDescription):

	- an object's ID, unqualified ("24") or qualified ("(O)24")
	- a negative number: any object in that category ("-5" is any egg)
	- in the Vault, "-1": gold, paid with the bundle menu's purchase button,
	  which charges the last ingredient's stack (JunimoNoteMenu)
*/

/** The bundle menu lays out at most 12 items and slots (JunimoNoteMenu.addRectangleRowsToList) */
export const MAX_BUNDLE_ITEMS = 12;
/** The most of one item a slot can ask for: a full stack */
export const MAX_INGREDIENT_STACK = 999;
/** The Vault's ingredient: gold */
export const GOLD = "-1";
/** The most a Vault bundle can cost (the game keeps money in an int) */
export const MAX_GOLD = 2_147_483_647;

/** Minimum qualities a slot can ask for */
export const BUNDLE_QUALITIES = new Map([
	[0, "Any"],
	[1, "Silver+"],
	[2, "Gold+"],
	[4, "Iridium"],
]);

/** Categories the bundle menu has a name for, so it can show what it wants (JunimoNoteMenu.setUpBundleSpecificPage) */
export const BUNDLE_CATEGORIES = new Map<number, string>([
	[ObjectCategory.Gem, "Any Gem"],
	[ObjectCategory.Vegetable, "Any Vegetable"],
	[ObjectCategory.Fish, "Any Fish"],
	[ObjectCategory.Egg, "Any Egg"],
	[ObjectCategory.Milk, "Any Milk"],
]);

export type IngredientKind = "gold" | "category" | "item" | "unknown";

/** An unqualified object ID ("(O)24" is "24") */
export const objectKey = (id: string) => id.replace(/^\(O\)/, "");

/** Like BundleIngredientDescription: a negative number is a category */
const categoryOf = (id: string) =>
	/^-\d+$/.test(id) ? Number.parseInt(id, 10) : undefined;

export function ingredientKind(id: string): IngredientKind {
	if (id === GOLD) return "gold";
	if (categoryOf(id) !== undefined) return "category";
	return ObjectData.has(objectKey(id)) ? "item" : "unknown";
}

/** The object drawn for an ingredient: a category's first object, as in JunimoNoteMenu.GetRepresentativeItemId */
export function ingredientObject(id: string): RegularObject | undefined {
	const category = categoryOf(id);
	if (category === undefined)
		return ObjectData.get(objectKey(id)) as RegularObject | undefined;
	for (const item of ObjectData.values())
		if ((item as RegularObject).category === category)
			return item as RegularObject;
}

export function ingredientName(id: string) {
	const category = categoryOf(id);
	if (id === GOLD) return "Gold";
	if (category !== undefined) {
		const known = BUNDLE_CATEGORIES.get(category);
		if (known) return known;
		const name = ObjectCategory[category];
		return name ? `Any ${name.replace(/(?<=[a-z])(?=[A-Z])/g, " ")}` : id;
	}
	return ObjectData.get(objectKey(id))?.name ?? id;
}

/**
	Whether a slot can ask for better than normal quality. The game takes an
	item when its quality is at least the slot's (Bundle.IsValidItemForThisIngredientDescription),
	so asking more of an item that never has a quality could never be filled.
	Unknown (modded) items aren't limited.
*/
export function canHaveQuality(id: string) {
	const kind = ingredientKind(id);
	if (kind === "gold") return false;
	if (kind === "unknown") return true;
	const category =
		categoryOf(id) ?? (ObjectData.get(objectKey(id)) as RegularObject).category;
	return CategoriesWithQuality.has(category);
}

/** Whether text can be an ingredient's ID without breaking the bundle's data (fields are split on "/" and " ") */
export const isValidIngredientId = (id: string) => /^[^\s/]+$/.test(id);

export interface IngredientChoice {
	id: string;
	name: string;
}

/**
	What can be picked for a bundle: the categories the bundle menu names, then
	objects. Not flavored variants, which share their base object's ID (so
	"Anchovy Roe" would really ask for any Roe), nor litter or quest items,
	which can't be carried to a bundle.
*/
export const ingredientChoices: readonly IngredientChoice[] = (() => {
	const objects = [...ObjectData.values()] as RegularObject[];
	const usable = objects.filter(
		(item) => !["Litter", "Quest"].includes(item.type),
	);
	// Some objects share a name (white and brown eggs), so tell them apart by ID
	const names = new Map<string, number>();
	for (const item of usable)
		names.set(item.name, (names.get(item.name) ?? 0) + 1);
	return [
		...[...BUNDLE_CATEGORIES].map(([category, name]) => ({
			id: String(category),
			name,
		})),
		...usable.map((item) => ({
			id: item._key,
			name:
				(names.get(item.name) ?? 0) > 1
					? `${item.name} (${item._key})`
					: item.name,
		})),
	];
})();
