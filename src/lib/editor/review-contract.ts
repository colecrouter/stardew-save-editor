import type { JsonPatch } from "effect";
import type { InventoryReviewChange } from "./review-inventory.ts";

/** A feature registry is closed on purpose: a new section needs a projector and label. */
export const reviewFeatures = [
	"farm",
	"calendar",
	"character",
	"inventory",
	"relationships",
	"quests",
	"qi",
	"community",
	"buildings",
	"pets",
	"farmhands",
	"recipes",
	"events",
	"appearance",
] as const;
export type ReviewFeature = (typeof reviewFeatures)[number];
export type ReviewValue = string | number | boolean | null;
export interface FieldReviewChange {
	readonly _tag: "FieldChanged";
	readonly subject: string;
	readonly label: string;
	readonly before: ReviewValue;
	readonly after: ReviewValue;
}
export interface EntityReviewChange {
	readonly _tag: "EntityAdded" | "EntityRemoved";
	readonly subject: string;
	readonly label: string;
	readonly value: ReviewValue;
}
/** Presentation exhaustiveness is independent of the open-ended command journal. */
export type ReviewChange =
	| FieldReviewChange
	| EntityReviewChange
	| InventoryReviewChange;
export interface ReviewGroup {
	readonly feature: ReviewFeature;
	readonly label: string;
	readonly changes: readonly ReviewChange[];
}
export interface ReviewView {
	readonly revision: number;
	readonly groups: readonly ReviewGroup[];
	/** Actual export patches which no semantic projector can safely account for. */
	readonly otherChanges: JsonPatch.JsonPatch;
}
