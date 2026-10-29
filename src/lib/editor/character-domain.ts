import type { EditorModel } from "./editor-model.ts";
import type { ImmediateField } from "./immediate-field.ts";
import {
	setCharacter,
	type CharacterChange,
	type CharacterView,
} from "./character-operations.ts";
import { professionDefinitions } from "./character-data.ts";

type ProfessionField = (typeof professionDefinitions)[number] & {
	field: ImmediateField<boolean>;
};
/** Character-facing values with captured editor operations, never XML array/stat details. */
export interface CharacterDomain extends Omit<CharacterView, "skills"> {
	skills: (CharacterView["skills"][number] & {
		fields: { xp: ImmediateField<number>; level: ImmediateField<number> };
		professionBranches: {
			primary: ProfessionField;
			secondary: ProfessionField[];
		}[];
	})[];
	fields: {
		masteryXp: ImmediateField<number>;
	};
}

/** Capture stable farmer identity once; a later selection never retargets queued field work. */
export function createCharacterDomain(
	view: CharacterView,
	model: EditorModel,
): CharacterDomain {
	function field<T extends string | number | boolean>(
		property: string,
		label: string,
		value: T | undefined,
		available: boolean,
		change: (value: T) => CharacterChange,
		constraints?: ImmediateField<T>["constraints"],
		reason?: string,
	): ImmediateField<T> {
		const key = `character:${JSON.stringify([view.farmerId, property])}`;
		return {
			scope: model.edits.scope,
			key,
			label,
			value,
			available,
			constraints,
			reason,
			begin: () => model.edits.begin(key),
			commit: (value, gesture) =>
				model.commands.edit(setCharacter(change(value)), gesture),
			end: (gesture) => model.edits.end(gesture),
		};
	}
	// Profession branches are resolved once in the domain view. The screen renders
	// these relationships without knowing numeric IDs, prerequisites or list shape.
	const professions = professionDefinitions.map((profession) => ({
		...profession,
		field: field(
			`profession:${profession.id}`,
			profession.name,
			view.professions.values.includes(profession.id),
			view.professions.supported &&
				(profession.parent === undefined ||
					view.professions.values.includes(profession.parent) ||
					view.professions.values.includes(profession.id)),
			(enabled) => ({
				farmerId: view.farmerId,
				kind: "profession",
				profession: profession.id,
				enabled,
			}),
			undefined,
			view.professions.reason,
		),
	}));
	const professionFields = Object.fromEntries(
		professions.map((profession) => [profession.id, profession.field]),
	);
	const masteryXp = field(
		"mastery:xp",
		"Mastery XP",
		view.mastery.xp,
		view.mastery.supported,
		(value) => ({ farmerId: view.farmerId, kind: "mastery-xp", value }),
		{ min: view.mastery.minXp, max: 2147483647, step: 1 },
		view.mastery.reason,
	);
	return {
		...view,
		skills: view.skills.map((skill) => ({
			...skill,
			professionBranches: professions
				.filter(
					(profession) =>
						profession.skill === skill.key && profession.parent === undefined,
				)
				.map((primary) => ({
					primary,
					secondary: professions.filter(
						(profession) => profession.parent === primary.id,
					),
				})),
			fields: {
				xp: field(
					`skill:${skill.key}:xp`,
					`${skill.label} XP`,
					skill.xp,
					skill.supported,
					(value) => ({
						farmerId: view.farmerId,
						kind: "skill-xp",
						skill: skill.key,
						value,
					}),
					{ min: 0, max: 99999, step: 1 },
					skill.reason,
				),
				level: field(
					`skill:${skill.key}:level`,
					`${skill.label} level`,
					skill.level,
					skill.supported,
					(value) => ({
						farmerId: view.farmerId,
						kind: "skill-level",
						skill: skill.key,
						value,
					}),
					{ min: 0, max: 10, step: 1 },
					skill.reason,
				),
			},
		})),
		fields: { masteryXp },
	};
}
