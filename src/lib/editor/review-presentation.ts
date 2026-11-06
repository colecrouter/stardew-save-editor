import type { ReviewChange, ReviewValue } from "./review-contract.ts";
import { inventoryQualities } from "./inventory-policy.ts";

/** The renderer consumes this one small row shape, never arbitrary save objects. */
export interface ReviewRow {
	readonly label: string;
	readonly context: string;
	readonly before: string;
	readonly after: string;
}
export function formatReviewValue(value: ReviewValue): string {
	if (value === null) return "—";
	if (typeof value === "boolean") return value ? "Yes" : "No";
	return typeof value === "number" ? value.toLocaleString() : value;
}
function quality(value: number | null): string {
	return value === null
		? "—"
		: (inventoryQualities.find((entry) => entry.value === value)?.label ??
				`Custom quality ${value}`);
}
function amount(quantity: number | null, tier: number | null): string {
	return [
		quantity === null ? "Quantity unavailable" : quantity.toLocaleString(),
		tier === null || tier === 0 ? undefined : `${quality(tier)} quality`,
	]
		.filter(Boolean)
		.join(" · ");
}
/** Adding a new declared variant requires a presentation decision at compile time. */
function unreachable(_change: never): never {
	throw new Error("Unhandled review change variant");
}
export function presentReviewChange(change: ReviewChange): ReviewRow {
	switch (change._tag) {
		case "FieldChanged":
			return {
				label: change.label,
				context: change.subject,
				before: formatReviewValue(change.before),
				after: formatReviewValue(change.after),
			};
		case "EntityAdded":
			return {
				label: change.label,
				context: change.subject,
				before: "Not present",
				after: formatReviewValue(change.value),
			};
		case "EntityRemoved":
			return {
				label: change.label,
				context: change.subject,
				before: formatReviewValue(change.value),
				after: "Not present",
			};
		case "ItemAdded":
			return {
				label: change.item.name,
				context: `Added · ${change.location}`,
				before: "Not present",
				after: amount(change.quantity, change.quality),
			};
		case "ItemRemoved":
			return {
				label: change.item.name,
				context: `Removed · ${change.location}`,
				before: amount(change.quantity, change.quality),
				after: "Not present",
			};
		case "ItemMoved":
			return {
				label: change.item.name,
				context: "Location",
				before: change.before,
				after: change.after,
			};
		case "ItemFieldChanged":
			return {
				label: `${change.item.name} · ${change.label}`,
				context: change.subject,
				before:
					change.field === "quality"
						? quality(change.before)
						: formatReviewValue(change.before),
				after:
					change.field === "quality"
						? quality(change.after)
						: formatReviewValue(change.after),
			};
		default:
			return unreachable(change);
	}
}
