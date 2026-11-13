import { Effect, Result, Schema } from "effect";
import { derived } from "svelte/store";
import type { EditorModel } from "./editor-model.ts";
import { FieldValidationError, type Field } from "./field.ts";
import { editChild } from "./children-operations.ts";

// Strings retain incomplete number input and unknown imported appearance until
// Apply. Keep is a hat action, never a reconstructed copy of the original item.
const draftSchema = Schema.Struct({
	name: Schema.String,
	gender: Schema.Literals(["", "Male", "Female"]),
	skin: Schema.Literals(["", "light", "dark"]),
	daysOld: Schema.String,
	hat: Schema.String,
});
export type ChildEditDraft = typeof draftSchema.Type;
const decodeDraft = Schema.decodeUnknownResult(draftSchema, {
	onExcessProperty: "error",
});

/** A mounted resident owns one field. Each published value captures its exact
 * identity and revision; the shared draft controller retains that handle while
 * dirty, and releases its store subscription when the component unmounts. */
export function createChildEditField(
	key: string,
	model: EditorModel,
): Field<ChildEditDraft> {
	return {
		label: "Child details",
		description: "Apply the child's details as one undoable change.",
		format: JSON.stringify,
		parse: (text) =>
			Effect.gen(function* () {
				const raw: unknown = yield* Effect.try({
					try: () => JSON.parse(text),
					catch: () =>
						new FieldValidationError({
							message: "Choose valid child details.",
						}),
				});
				const decoded = decodeDraft(raw);
				if (Result.isFailure(decoded))
					return yield* new FieldValidationError({
						message: "Choose valid child details.",
					});
				return decoded.success;
			}),
		value: derived(model.view, (view) => {
			const child = view?.children.find((candidate) => candidate.key === key);
			const initial: ChildEditDraft = {
				name: child?.name ?? "",
				gender:
					child?.gender === "Male" || child?.gender === "Female"
						? child.gender
						: "",
				skin:
					child?.darkSkinned === true
						? "dark"
						: child?.darkSkinned === false
							? "light"
							: "",
				daysOld: child?.daysOld?.toString() ?? "",
				hat: "keep",
			};
			return {
				key: JSON.stringify([key, child?.name, child?.parentId]),
				value: initial,
				revision: view?.revision ?? -1,
				available: child?.supported ?? false,
				commit: (value: ChildEditDraft) =>
					model.commands.transact(
						editChild({
							key,
							name: child?.name ?? "",
							parentId: child?.parentId ?? "",
							// Diff against this captured source, not the latest selection.
							// Unchanged and unfamiliar saved fields remain untouched.
							changes: {
								...(value.name !== initial.name ? { name: value.name } : {}),
								...(value.gender !== initial.gender && value.gender !== ""
									? { gender: value.gender }
									: {}),
								...(value.skin !== initial.skin && value.skin !== ""
									? { darkSkinned: value.skin === "dark" }
									: {}),
								...(value.daysOld !== initial.daysOld
									? {
											daysOld: /^\d+$/.test(value.daysOld)
												? Number(value.daysOld)
												: NaN,
										}
									: {}),
								...(value.hat === "remove"
									? { hat: { kind: "remove" as const } }
									: value.hat.startsWith("catalog:")
										? {
												hat: {
													kind: "catalog" as const,
													id: value.hat.slice(8),
												},
											}
										: {}),
							},
						}),
						view?.revision ?? -1,
					),
			};
		}),
	};
}
