import type { ImmutableView } from "./immutable-view.ts";
import type { AnimalView, BuildingView } from "./building-data.ts";
import { bindImmediateField, type DomainEditPort } from "./field-binding.ts";
import {
	setAnimal,
	adoptAnimal,
	upgradeBuilding,
	setGreenhouseRepaired,
} from "./building-operations.ts";

/** Project editable animal fields from intuitive values; saved property names stay in the adapter. */
export function createAnimalDomain(
	view: ImmutableView<AnimalView>,
	model: DomainEditPort,
) {
	const base = { available: view.supported, reason: view.reason };
	const numeric = (
		kind: "daysOwned" | "friendship" | "happiness" | "fullness",
		label: string,
		max: number,
	) =>
		bindImmediateField(
			model,
			{
				...base,
				key: `animal:${JSON.stringify([view.id, kind])}`,
				label,
				value: view[kind],
				available: view.supported && view[kind] !== undefined,
				constraints: { min: 0, max, step: 1 },
			},
			(value: number) => setAnimal({ animalId: view.id, kind, value }),
		);
	return {
		...view,
		fields: {
			name: bindImmediateField(
				model,
				{
					...base,
					available: view.supported && view.nameEditable,
					reason:
						view.reason ??
						(!view.nameEditable ? "The saved name is unsupported." : undefined),
					key: `animal:${view.id}:name`,
					label: "Name",
					value: view.name,
				},
				(value: string) =>
					setAnimal({ animalId: view.id, kind: "name", value }),
			),
			daysOwned: numeric("daysOwned", "Days owned", 2147483647),
			friendship: numeric("friendship", "Friendship", 1000),
			happiness: numeric("happiness", "Happiness", 255),
			fullness: numeric("fullness", "Fullness", 255),
			gender: bindImmediateField(
				model,
				{
					...base,
					key: `animal:${view.id}:gender`,
					label: "Gender",
					value: view.gender,
					available: view.supported && view.gender !== undefined,
					options: ["Undefined", "Female", "Male"].map((value) => ({
						value,
						label: value === "Undefined" ? "Unspecified" : value,
					})),
				},
				(value: string) =>
					setAnimal({ animalId: view.id, kind: "gender", value }),
			),
			reproduction: bindImmediateField(
				model,
				{
					...base,
					key: `animal:${view.id}:reproduction`,
					label: "Allow pregnancy",
					value: view.reproduction,
					available:
						view.supported &&
						view.canReproduce &&
						view.reproduction !== undefined,
				},
				(value: boolean) =>
					setAnimal({ animalId: view.id, kind: "reproduction", value }),
			),
			cracker: bindImmediateField(
				model,
				{
					...base,
					key: `animal:${view.id}:cracker`,
					label: "Golden Animal Cracker",
					value: view.cracker,
					available:
						view.supported && view.canEatCracker && view.cracker !== undefined,
				},
				(value: boolean) =>
					setAnimal({ animalId: view.id, kind: "cracker", value }),
			),
		},
	};
}
/** Discrete actions capture the building identity; selecting another building cannot retarget queued work. */
export function createBuildingDomain(
	view: ImmutableView<BuildingView>,
	model: DomainEditPort,
) {
	return {
		...view,
		animals: view.animals.map((animal) => createAnimalDomain(animal, model)),
		repair: bindImmediateField(
			model,
			{
				key: `building:${view.id}:repair`,
				label: "Greenhouse repaired",
				value: view.repaired,
				available: view.supported && view.repaired !== undefined,
			},
			(value: boolean) => setGreenhouseRepaired(view.id, value),
		),
		upgrade: (target: string) =>
			model.commands.transact(upgradeBuilding(view.id, target)),
		adopt: (type: string, name: string, farmerId: string) =>
			model.commands.transact(adoptAnimal(view.id, type, name, farmerId)),
	};
}
export type AnimalDomain = ReturnType<typeof createAnimalDomain>;
export type BuildingDomain = ReturnType<typeof createBuildingDomain>;
