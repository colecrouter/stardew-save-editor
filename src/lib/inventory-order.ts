/** The game's tool partition and comparison order, shared by proxy and domain organizers. */
const toolTypes = new Set([
	"Tool",
	"MeleeWeapon",
	"Slingshot",
	"FishingRod",
	"WateringCan",
	"Pickaxe",
	"Axe",
	"Hoe",
	"Pan",
	"MilkPail",
	"Shears",
	"Wand",
	"GenericTool",
]);
export interface InventorySortFields {
	readonly "@_xsi:type"?: unknown;
	readonly category?: unknown;
	readonly name?: unknown;
	readonly parentSheetIndex?: unknown;
	readonly quality?: unknown;
	readonly stack?: unknown;
	readonly type?: unknown;
}
const number = (value: unknown, fallback = 0) => {
	const parsed =
		typeof value === "number" || typeof value === "string"
			? Number(value)
			: fallback;
	return Number.isFinite(parsed) ? parsed : fallback;
};
const text = (value: unknown) => (typeof value === "string" ? value : "");
export const isInventoryTool = (item: InventorySortFields) =>
	toolTypes.has(text(item["@_xsi:type"]));
const category = (item: InventorySortFields) =>
	number(item.category) === -100 ? -94 : number(item.category);
const isObject = (item: InventorySortFields) =>
	!isInventoryTool(item) && item.type !== undefined;
/** Item.CompareTo: category, equivalent-item quality/count, then object type and name. */
export function compareInventoryItems(
	a: InventorySortFields,
	b: InventorySortFields,
	aCount = number(a.stack, 1),
	bCount = number(b.stack, 1),
) {
	if (number(a.category) !== number(b.category))
		return category(b) - category(a);
	if (a.name === b.name && a.parentSheetIndex === b.parentSheetIndex) {
		const quality = number(b.quality) - number(a.quality);
		return quality || aCount - bCount;
	}
	if (isObject(a) && isObject(b))
		return `${text(a.type)}${text(a.name)}`.localeCompare(
			`${text(b.type)}${text(b.name)}`,
		);
	return text(a.name).localeCompare(text(b.name));
}
