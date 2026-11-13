import { Data, Effect, Result, Schema } from "effect";
import characterNames from "../../../generated/character-names.json";
import { farmers } from "./domain.ts";
import { childStage, inspectResidents, readChildren } from "./children-data.ts";
import { record } from "./plain-data.ts";
import { TransactionDraft } from "./transaction-draft.ts";
import {
	recordAnnotatedOperation,
	withReviewMetadata,
} from "./transaction-annotations.ts";

export class ChildRenameInvalid extends Data.TaggedError("ChildRenameInvalid")<{
	readonly message: string;
}> {}
const renameSchema = Schema.Struct({
	key: Schema.String,
	name: Schema.String,
	parentId: Schema.String,
	newName: Schema.String,
});

const editSchema = Schema.Struct({
	key: Schema.String,
	name: Schema.String,
	parentId: Schema.String,
	changes: Schema.Struct({
		name: Schema.optionalKey(Schema.String),
		gender: Schema.optionalKey(Schema.Literals(["Male", "Female"])),
		darkSkinned: Schema.optionalKey(Schema.Boolean),
		// Leave room for the game's next signed-Int32 day increment.
		daysOld: Schema.optionalKey(
			Schema.Number.check(
				Schema.isInt(),
				Schema.isBetween({ minimum: 0, maximum: 2147483646 }),
			),
		),
		hat: Schema.optionalKey(
			Schema.Union([
				Schema.Struct({ kind: Schema.Literal("remove") }),
				Schema.Struct({ kind: Schema.Literal("catalog"), id: Schema.String }),
			]),
		),
	}),
});
export type ChildEdit = typeof editSchema.Type;
const decodeEdit = Schema.decodeUnknownResult(editSchema, {
	onExcessProperty: "error",
});

/** One Apply owns the whole transaction. Only requested fields change; expected
 * failures, including a late rename collision, roll back every staged write. */
export const editChild = Effect.fn("Children.edit")(function* (
	input: ChildEdit,
) {
	// Own-field copies apply at each request boundary, including nested actions;
	// inherited properties must not authorize edits omitted by the caller.
	const own = record(input) ? { ...input } : input;
	const decoded = decodeEdit(
		record(own)
			? {
					...own,
					changes: record(own.changes)
						? {
								...own.changes,
								...(Object.hasOwn(own.changes, "hat") && record(own.changes.hat)
									? { hat: { ...own.changes.hat } }
									: {}),
							}
						: own.changes,
				}
			: own,
	);
	if (Result.isFailure(decoded))
		return yield* new ChildRenameInvalid({
			message:
				"Choose valid child details and a whole-number age between 0 and 2147483646.",
		});
	const request = decoded.success;
	const transaction = yield* TransactionDraft;
	const snapshot = yield* transaction.read;
	const document = snapshot.state.document;
	const row = readChildren(document).find((child) => child.key === request.key);
	const target = inspectResidents(document).find(
		(resident) => resident.key === request.key,
	);
	if (
		!row?.supported ||
		!target ||
		row.name !== request.name ||
		row.parentId !== request.parentId
	)
		return yield* new ChildRenameInvalid({
			message: row?.reason ?? "This child changed. Reload the current details.",
		});
	const changes = request.changes;
	const resident = target.resident;
	const ageChanged =
		changes.daysOld !== undefined && changes.daysOld !== resident.daysOld;
	const stage =
		changes.daysOld !== undefined ? childStage(changes.daysOld) : row.stage;
	// Babies and crawlers use the home's crib. Do not author a younger child into
	// a home with a removed or unreadable crib; the editor does not renovate it.
	if (
		ageChanged &&
		stage !== undefined &&
		stage < 3 &&
		(typeof target.home.cribStyle !== "number" ||
			!Number.isInteger(target.home.cribStyle) ||
			target.home.cribStyle <= 0)
	)
		return yield* new ChildRenameInvalid({
			message:
				"Restore a crib in this home before choosing an age under 55 days.",
		});
	// Vanilla interaction equips hats only on toddlers. A younger age must not
	// silently destroy a saved hat, including opaque/custom ones.
	if (
		(ageChanged &&
			stage !== 3 &&
			row.hat.present &&
			changes.hat?.kind !== "remove") ||
		(changes.hat?.kind === "catalog" && stage !== 3)
	)
		return yield* new ChildRenameInvalid({
			message:
				"Hats can be equipped on toddlers. Choose Remove hat before making this child younger.",
		});
	let changed = false;
	if (changes.hat?.kind === "catalog") {
		// Trusted catalog construction is shared with Inventory and loaded only
		// when replacing a hat; Keep preserves the exact imported record.
		const catalog = yield* Effect.promise(() => import("./item-catalog.ts"));
		const hat = catalog.createCatalogItem(changes.hat.id);
		if (hat?.$type !== "StardewValley.Objects.Hat")
			return yield* new ChildRenameInvalid({
				message: "Choose a supported hat from the catalog.",
			});
		resident.hat = hat;
		changed = true;
	} else if (changes.hat?.kind === "remove" && resident.hat != null) {
		resident.hat = null;
		changed = true;
	}
	// Gender and skin tone are independent saved appearance fields; reloadSprite
	// selects the correct sheet when the game loads/updates this child.
	if (changes.gender !== undefined && changes.gender !== resident.gender) {
		resident.gender = changes.gender;
		changed = true;
	}
	if (
		changes.darkSkinned !== undefined &&
		changes.darkSkinned !== resident.darkSkinned
	) {
		resident.darkSkinned = changes.darkSkinned;
		changed = true;
	}
	if (ageChanged) {
		// Keep the current stage and movement speed consistent immediately. Runtime
		// positions, bed assignment, daily flags and overnight events are not simulated.
		resident.daysOld = changes.daysOld;
		resident.age = stage;
		resident.Speed = stage === 3 ? 4 : 1;
		changed = true;
	}
	if (changed)
		yield* recordAnnotatedOperation(transaction.replace(snapshot)).pipe(
			withReviewMetadata({
				label: `Edit child ${request.name}`,
				emphasis: "standalone",
				tags: ["relationships", "children:edit"],
			}),
		);
	// Reuse the checked linked-reference migration after other staging succeeds.
	// The enclosing history transaction still publishes exactly one Undo entry.
	if (changes.name !== undefined && changes.name !== request.name)
		yield* renameChild({
			key: request.key,
			name: request.name,
			parentId: request.parentId,
			newName: changes.name,
		});
});
export type ChildRename = typeof renameSchema.Type;
const decode = Schema.decodeUnknownResult(renameSchema, {
	onExcessProperty: "error",
});

/** The caller also supplies its captured revision to the command queue. The
 * address/name/parent checks below defend direct callers and stale target changes. */
export const renameChild = Effect.fn("Children.rename")(function* (
	input: ChildRename,
) {
	const decoded = decode(record(input) ? { ...input } : input);
	if (Result.isFailure(decoded))
		return yield* new ChildRenameInvalid({
			message: "Choose a valid child rename.",
		});
	const request = decoded.success;
	// Preserve the exact internal name once accepted. Birth code uses trailing
	// spaces to disambiguate identities; never silently trim an imported key.
	if (
		!request.newName.trim() ||
		request.newName !== request.newName.trim() ||
		// Control characters are deliberately rejected in user-authored names.
		// oxlint-disable-next-line no-control-regex
		/[\u0000-\u001f\u007f]/u.test(request.newName)
	)
		return yield* new ChildRenameInvalid({
			message:
				"Enter a name without surrounding whitespace or control characters.",
		});
	const transaction = yield* TransactionDraft;
	const snapshot = yield* transaction.read;
	const document = snapshot.state.document;
	const row = readChildren(document).find((child) => child.key === request.key);
	if (
		!row?.supported ||
		row.name !== request.name ||
		row.parentId !== request.parentId
	)
		return yield* new ChildRenameInvalid({
			message: row?.reason ?? "This child changed. Reopen the rename form.",
		});
	if (request.newName === request.name) return;
	const residents = inspectResidents(document);
	const owners = farmers(document);
	// Name-keyed progress belongs to all farmers, including offline farmhands.
	// Reject destination collisions instead of merging unrelated relationships.
	if (
		characterNames.includes(request.newName) ||
		residents.some(({ resident }) => resident.name === request.newName) ||
		owners.some((owner) =>
			[owner.friendshipData, owner.giftedItems].some((dictionary) =>
				dictionary?.some((entry) => entry.key === request.newName),
			),
		)
	)
		return yield* new ChildRenameInvalid({
			message:
				"That name already identifies a character or saved relationship. Choose another name.",
		});
	const target = residents.find((resident) => resident.key === request.key);
	if (!target)
		return yield* new ChildRenameInvalid({
			message: "This child is no longer available.",
		});
	// Only keys move: friendship points, daily interaction flags, gift history,
	// entry order and opaque extension data retain their exact saved values.
	target.resident.name = request.newName;
	for (const owner of owners)
		for (const dictionary of [owner.friendshipData, owner.giftedItems])
			for (const entry of dictionary ?? [])
				if (entry.key === request.name) entry.key = request.newName;
	yield* recordAnnotatedOperation(transaction.replace(snapshot)).pipe(
		withReviewMetadata({
			label: `Rename child ${request.name} to ${request.newName}`,
			emphasis: "standalone",
			tags: ["relationships", "children:rename"],
		}),
	);
});
