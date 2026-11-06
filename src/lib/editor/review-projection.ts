import type { Save } from "../../../codegen/save.ts";
import { formatDate, weatherLabel } from "../calendar.ts";
import { readCalendarView } from "../calendarDocument.ts";
import { VanillaEventsById } from "../Events.ts";
import { readAppearances } from "./appearance-operations.ts";
import { inspectPets, readPets } from "./pet-data.ts";
import { readBuildings } from "./building-data.ts";
import { professionDefinitions } from "./character-data.ts";
import { readCharacters } from "./character-operations.ts";
import {
	readCommunity,
	type CommunityRequirementView,
} from "./community-data.ts";
import { resolveItemMetadata } from "./item-presentation.ts";
import { inventoryQualities } from "./inventory-policy.ts";
import { farmers, type SaveDocument } from "./domain.ts";
import { readEvents } from "./event-operations.ts";
import { readFarmerRoster } from "./farmer-roster-data.ts";
import { readFarmSettings, type FarmSettings } from "./farm-operations.ts";
import type { HistoryState } from "./history.ts";
import { readQuestJournals } from "./quest-operations.ts";
import { readQiOrders } from "./qi-order-operations.ts";
import { readRecipes } from "./recipe-operations.ts";
import { readRelationships } from "./relationship-operations.ts";
import { projectInventoryReview } from "./review-inventory.ts";
import {
	reviewFeatures,
	type ReviewChange,
	type ReviewFeature,
	type ReviewValue,
	type ReviewView,
} from "./review-contract.ts";
import { record } from "./saved-collections.ts";

interface ReviewRecord {
	readonly key: string;
	readonly subject: string;
	readonly label: string;
	readonly fields: Readonly<Record<string, ReviewValue | undefined>>;
	/** Only explicit serialized leaves are claimed; derived and opaque side effects remain visible. */
	readonly paths?: Readonly<Record<string, readonly string[] | undefined>>;
}
interface FeatureProjection {
	readonly changes: readonly ReviewChange[];
	readonly coveredPaths: readonly string[];
}
interface FeatureDefinition {
	readonly label: string;
	readonly records: (document: SaveDocument) => readonly ReviewRecord[];
}
const farmLabels = {
	name: "Farm name",
	profitPercent: "Profit margin (%)",
	monsters: "Monsters at night",
	mineRewards: "Mine rewards",
} satisfies Record<keyof FarmSettings, string>;
const farmPaths = {
	name: ["/SaveGame/player/farmName"],
	profitPercent: ["/SaveGame/player/difficultyModifier"],
	monsters: ["/SaveGame/shouldSpawnMonsters"],
	mineRewards: ["/SaveGame/shuffleMineChests"],
} satisfies Record<keyof FarmSettings, readonly string[]>;
const scalar = (value: unknown): value is ReviewValue =>
	value === null ||
	typeof value === "string" ||
	typeof value === "boolean" ||
	(typeof value === "number" && Number.isFinite(value));

// Imported identifiers may be opaque objects, including objects with a
// non-callable toString. Only established scalar identities may be compared.
function ownerIdentity(owner: unknown): string | undefined {
	if (!record(owner)) return undefined;
	const id = owner.UniqueMultiplayerID;
	return typeof id === "string" ||
		(typeof id === "number" && Number.isFinite(id))
		? String(id)
		: undefined;
}

/** Resolve serialized owner positions privately; no raw owner/field data enters the view. */
function ownerPaths(document: SaveDocument): Map<string, string> {
	const owners = farmers(document);
	const paths = new Map<string, string>();
	const duplicates = new Set<string>();
	for (const [index, owner] of owners.entries()) {
		const key = ownerIdentity(owner);
		if (key === undefined) continue;
		if (paths.has(key)) duplicates.add(key);
		paths.set(
			key,
			index === 0
				? "/SaveGame/player"
				: `/SaveGame/farmhands/Farmer/${index - 1}`,
		);
	}
	for (const id of duplicates) paths.delete(id);
	return paths;
}

/** Describe actual donated requirements without leaking saved item IDs as the main vocabulary. */
function donationLabel(item: CommunityRequirementView): string {
	if (item.currency) return `${item.quantity.toLocaleString()}g`;
	const name = /^-\d+$/.test(item.itemId)
		? `Any item in category ${item.itemId}`
		: (resolveItemMetadata({ itemId: item.itemId, "@_xsi:type": "Object" })
				?.name ?? `Item ${item.itemId}`);
	const quality = item.quality
		? ` (${inventoryQualities.find((row) => row.value === item.quality)?.label ?? `quality ${item.quality}`})`
		: "";
	return `${item.quantity} × ${name}${quality}`;
}

const definitions = {
	farm: {
		label: "Farm settings",
		records: (document) => {
			const view = readFarmSettings(document);
			return [
				{
					key: "farm",
					subject: "Farm",
					label: "Farm settings",
					fields: Object.fromEntries(
						Object.entries(farmLabels).map(([key, label]) => [
							label,
							view[key as keyof FarmSettings],
						]),
					),
					paths: Object.fromEntries(
						Object.entries(farmLabels).map(([key, label]) => [
							label,
							farmPaths[key as keyof FarmSettings],
						]),
					),
				},
			];
		},
	},
	calendar: {
		label: "Date and weather",
		records: (document) => {
			// The existing calendar adapter owns saved enum/weather representations.
			const view = readCalendarView(document.SaveGame as unknown as Save);
			return [
				{
					key: "calendar",
					subject: "Farm",
					label: "Date and weather",
					fields: {
						Date: formatDate(view.date),
						Today: weatherLabel(view.today),
						Tomorrow: weatherLabel(view.tomorrow),
					},
					paths: {
						Date: [
							"/SaveGame/year",
							"/SaveGame/currentSeason",
							"/SaveGame/dayOfMonth",
						],
						Today: [
							"/SaveGame/isRaining",
							"/SaveGame/isSnowing",
							"/SaveGame/isLightning",
							"/SaveGame/isDebrisWeather",
							"/SaveGame/isGreenRain",
						],
						Tomorrow: ["/SaveGame/weatherForTomorrow"],
					},
				},
			];
		},
	},
	character: {
		label: "Character",
		records: (document) => {
			const paths = ownerPaths(document);
			const owners = farmers(document);
			return readCharacters(document)
				.filter((owner) => owner.supported)
				.map((owner) => {
					const raw = owners.find(
						(candidate) => ownerIdentity(candidate) === owner.farmerId,
					);
					const path = paths.get(owner.farmerId);
					return {
						key: owner.farmerId,
						subject: owner.name,
						label: "Character",
						fields: {
							Gold: typeof raw?.money === "number" ? raw.money : undefined,
							...Object.fromEntries(
								owner.details.numbers.map((field) => [
									field.label,
									field.value,
								]),
							),
							...Object.fromEntries(
								owner.details.wallet.map((field) => [
									field.label,
									field.available ? field.value : undefined,
								]),
							),
							"Backpack slots": owner.details.backpackSize,
							"House level": owner.details.houseLevel,
							...Object.fromEntries(
								owner.skills.flatMap((skill) => [
									[`${skill.label} level`, skill.level],
									[`${skill.label} experience`, skill.xp],
								]),
							),
							Professions: owner.professions.supported
								? owner.professions.values
										.map(
											(id) =>
												professionDefinitions.find(
													(profession) => profession.id === id,
												)?.name ?? `Unknown profession ${id}`,
										)
										.join(", ") || "None"
								: undefined,
							"Mastery experience": owner.mastery.xp,
							"Mastery levels spent": owner.mastery.spent,
						},
						paths: path
							? {
									Gold: [`${path}/money`],
									"Backpack slots": [`${path}/maxItems`],
									"House level": [`${path}/houseUpgradeLevel`],
								}
							: {},
					};
				});
		},
	},
	// The relationship catalog includes villagers absent from the save. Only
	// actual membership participates in added/removed relationship summaries.
	relationships: {
		label: "Relationships",
		records: (document) =>
			readRelationships(document)
				.filter((owner) => owner.supported)
				.flatMap((owner) => [
					...owner.relationships
						.filter((row) => row.present)
						.map((row) => ({
							key: JSON.stringify([owner.farmerId, row.name]),
							subject: owner.name,
							label: row.name,
							fields: {
								"Friendship points": row.points,
								"Gifts this week": row.gifts,
							},
						})),
					// Due dates are absolute facts. Do not include relative days here:
					// moving the calendar alone must not imply a pregnancy edit.
					...(owner.pregnancy.kind === "none"
						? []
						: [
								{
									key: JSON.stringify([
										owner.farmerId,
										"pregnancy",
										owner.pregnancy.targetKey,
									]),
									subject: owner.name,
									label: `Family planning with ${owner.pregnancy.spouse}`,
									fields: {
										"Expecting a baby": owner.pregnancy.expecting,
										"Baby due date": owner.pregnancy.dueDate ?? null,
									},
								},
							]),
				]),
	},
	quests: {
		label: "Quest journal",
		records: (document) =>
			readQuestJournals(document)
				.filter((owner) => owner.supported)
				.flatMap((owner) =>
					owner.quests.map((quest) => ({
						key: JSON.stringify([owner.farmerId, quest.renderKey]),
						subject: owner.name,
						label: quest.title,
						fields: {
							Status: quest.completed ? "Reward waiting" : "Active",
							"Gold reward": quest.secret ? undefined : quest.reward,
							"Days left":
								quest.timed && !quest.completed ? quest.daysLeft : undefined,
						},
					})),
				),
	},
	// Catalog-only challenges are not saved offers or active orders.
	qi: {
		label: "Qi orders",
		records: (document) =>
			readQiOrders(document)
				.rows.filter((row) => row.state !== undefined || row.offered)
				.map((row) => ({
					key: row.key,
					subject: "Farm",
					label: row.name,
					fields: {
						Status:
							row.state === "InProgress"
								? "Active"
								: row.state === "Complete"
									? "Reward waiting"
									: (row.state ?? "Board offer"),
						Offered: row.offered,
						Deadline: row.deadline,
					},
				})),
	},
	community: {
		label: "Community Center and Joja",
		records: (document) => {
			const view = readCommunity(document);
			return [
				{
					key: "route",
					subject: "Farm",
					label: "Restoration route",
					fields: {
						Route:
							view.membership === undefined
								? undefined
								: view.membership
									? "Joja membership"
									: "Community Center",
						"Movie Theater": view.theater,
					},
				},
				...view.bundles
					.filter((bundle) => bundle.supported)
					.map((bundle) => ({
						key: bundle.key,
						subject: "Community Center",
						label: bundle.name,
						fields: {
							Completed: bundle.completed,
							"Donations needed": bundle.needed,
							Requirements: bundle.requirements.map(donationLabel).join(", "),
							"Reward available": bundle.rewardSupported
								? bundle.rewardAvailable
								: undefined,
							Donations:
								bundle.requirements
									.filter((item) => item.submitted)
									.map(donationLabel)
									.join(", ") || "None",
						},
					})),
				...view.rooms.map((room) => ({
					key: `room:${room.id}`,
					subject: "Farm",
					label: room.name,
					fields: { Restored: room.restored },
				})),
			];
		},
	},
	pets: {
		label: "Pets",
		records: (document) => {
			// Claim only editable leaves. Bowl, mail and unknown pet data
			// must remain visible as raw changes if another operation touches them.
			const graph = inspectPets(document);
			return readPets(document)
				.filter((pet) => pet.supported)
				.map((pet) => {
					const path = graph.pets.find((row) => row.id === pet.id)?.path;
					return {
						key: pet.key,
						subject: "Pet",
						label: pet.name,
						fields: {
							Name: pet.nameEditable ? pet.name : undefined,
							Friendship: pet.friendship,
							Type: pet.appearance.value ? pet.type : undefined,
							Breed: pet.appearance.value ? pet.breed : undefined,
						},
						paths: path
							? {
									Name: [`${path}/name`],
									Friendship: [`${path}/friendshipTowardFarmer`],
									Type: [`${path}/petType`],
									Breed: [`${path}/whichBreed`],
								}
							: undefined,
					};
				});
		},
	},
	buildings: {
		label: "Buildings and animals",
		records: (document) => {
			const view = readBuildings(document);
			return [
				...view.buildings.map((building) => ({
					key: building.id,
					subject: building.location,
					label: building.name,
					fields: {
						Building: building.name,
						Capacity: building.capacity,
						Repaired: building.repaired,
					},
				})),
				...[
					...view.buildings.flatMap((building) => building.animals),
					...view.unhoused,
				].map((animal) => ({
					key: `animal:${animal.id}`,
					subject: animal.location,
					label: animal.name,
					fields: {
						Name: animal.name,
						Type: animal.type,
						"Days owned": animal.daysOwned,
						Friendship: animal.friendship,
						Happiness: animal.happiness,
						Fullness: animal.fullness,
						Gender: animal.gender,
						Reproduction: animal.reproduction,
						"Golden Animal Cracker": animal.cracker,
					},
				})),
			];
		},
	},
	farmhands: {
		label: "Farmhands",
		records: (document) =>
			readFarmerRoster(document).players.map((player) => ({
				key: player.farmerId,
				subject: player.name,
				label: "Farm role",
				fields: { Role: player.host ? "Host" : "Farmhand", Home: player.home },
			})),
	},
	// Known recipe membership is distinct from the complete editor catalog.
	recipes: {
		label: "Recipes",
		records: (document) =>
			readRecipes(document)
				.filter((owner) => owner.supported)
				.flatMap((owner) =>
					(["cooking", "crafting"] as const).flatMap((kind) =>
						owner[kind]
							.filter((row) => row.known)
							.map((row) => ({
								key: JSON.stringify([owner.farmerId, kind, row.name]),
								subject: owner.name,
								label: row.outputName ?? row.name,
								fields: {
									Kind:
										kind === "cooking" ? "Cooking recipe" : "Crafting recipe",
									Count: row.count,
								},
							})),
					),
				),
	},
	events: {
		label: "Events",
		records: (document) =>
			readEvents(document)
				.filter((owner) => owner.supported)
				.flatMap((owner) =>
					owner.seen.map((event) => ({
						key: JSON.stringify([owner.farmerId, event.id]),
						subject: owner.name,
						label: VanillaEventsById.get(event.id)?.name ?? `Event ${event.id}`,
						fields: { Status: "Seen" },
					})),
				),
	},
	appearance: {
		label: "Appearance",
		records: (document) => {
			const paths = ownerPaths(document);
			return readAppearances(document)
				.filter((owner) => owner.supported)
				.map((owner) => {
					const path = paths.get(owner.farmerId);
					return {
						key: owner.farmerId,
						subject: owner.name,
						label: "Appearance",
						fields: {
							Name: owner.texts.name.value,
							"Favorite thing": owner.texts.favorite.value,
							Gender: owner.gender.value,
							...Object.fromEntries(
								owner.numbers.map((field) => [field.label, field.value]),
							),
							...Object.fromEntries(
								owner.colors.map((field) => [field.label, field.value]),
							),
						},
						paths: path
							? {
									Name: [`${path}/name`],
									"Favorite thing": [`${path}/favoriteThing`],
									Gender: [`${path}/gender`],
								}
							: {},
					};
				});
		},
	},
} satisfies Record<Exclude<ReviewFeature, "inventory">, FeatureDefinition>;

/** Decode complete pointer segments before matching; slash escapes and index prefixes are distinct. */
export function isReviewPathCovered(
	path: string,
	coveredPaths: readonly string[],
): boolean {
	const segments = decodeReviewPointer(path);
	return coveredPaths.some((candidate) => {
		const prefix = decodeReviewPointer(candidate);
		return (
			prefix.length > 0 &&
			prefix.length <= segments.length &&
			prefix.every((part, index) => part === segments[index])
		);
	});
}
function decodeReviewPointer(path: string): string[] {
	return path === "" || !path.startsWith("/")
		? []
		: path
				.slice(1)
				.split("/")
				.map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));
}
function rawAt(document: SaveDocument, path: string): unknown {
	let value: unknown = document;
	for (const segment of decodeReviewPointer(path)) {
		if (Array.isArray(value)) value = value[Number(segment)];
		else if (record(value) && Object.hasOwn(value, segment))
			value = value[segment];
		else return undefined;
	}
	return value;
}
/** Only changed domain fields claim their explicit scalar leaves. No opaque child is inferred away. */
function compareRecords(
	before: readonly ReviewRecord[],
	after: readonly ReviewRecord[],
	state: HistoryState,
): FeatureProjection {
	const changes: ReviewChange[] = [],
		coveredPaths: string[] = [];
	const old = new Map(before.map((row) => [row.key, row]));
	const next = new Map(after.map((row) => [row.key, row]));
	// Duplicate domain identities cannot establish a before/after pairing safely.
	const duplicates = new Set<string>();
	for (const rows of [before, after]) {
		const seen = new Set<string>();
		for (const row of rows) {
			if (seen.has(row.key)) duplicates.add(row.key);
			seen.add(row.key);
		}
	}
	for (const key of new Set([...old.keys(), ...next.keys()])) {
		if (duplicates.has(key)) continue;
		const a = old.get(key),
			b = next.get(key),
			target = b ?? a;
		if (!target) continue;
		if (!a || !b) {
			changes.push({
				_tag: b ? "EntityAdded" : "EntityRemoved",
				subject: target.subject,
				label: target.label,
				value: target.fields.Status ?? target.fields.Kind ?? target.label,
			});
			continue;
		}
		for (const label of new Set([
			...Object.keys(a.fields),
			...Object.keys(b.fields),
		])) {
			const previous = a.fields[label] ?? null,
				current = b.fields[label] ?? null;
			if (previous === current) continue;
			changes.push({
				_tag: "FieldChanged",
				subject: b.subject,
				label:
					b.label === "Farm settings" ||
					b.label === "Character" ||
					b.label === "Appearance" ||
					b.label === "Date and weather"
						? label
						: `${b.label} · ${label}`,
				before: previous,
				after: current,
			});
			for (const path of new Set([
				...(a.paths?.[label] ?? []),
				...(b.paths?.[label] ?? []),
			])) {
				const rawBefore = rawAt(state.baseline, path),
					rawAfter = rawAt(state.document, path);
				if (
					(rawBefore === undefined || scalar(rawBefore)) &&
					(rawAfter === undefined || scalar(rawAfter))
				)
					coveredPaths.push(path);
			}
		}
	}
	return { changes, coveredPaths };
}

/** Produce detached semantic review data only on demand; history/annotations never substitute for net comparison. */
export function projectReview(state: HistoryState): ReviewView {
	if (!state.net.length)
		return { revision: state.revision, groups: [], otherChanges: [] };
	const inventory = projectInventoryReview(state);
	const projections = Object.fromEntries(
		Object.entries(definitions).map(([feature, definition]) => [
			feature,
			compareRecords(
				definition.records(state.baseline),
				definition.records(state.document),
				state,
			),
		]),
	);
	const coveredPaths = [
		...inventory.coveredPaths,
		...Object.values(projections).flatMap(
			(projection) => projection.coveredPaths,
		),
	];
	const groups = reviewFeatures.flatMap((feature) => {
		const projection =
			feature === "inventory" ? inventory : projections[feature];
		if (!projection?.changes.length) return [];
		return [
			{
				feature,
				label:
					feature === "inventory" ? "Inventory" : definitions[feature].label,
				changes: projection.changes,
			},
		];
	});
	// A coalesced parent patch is retained unless a projector explicitly accounts
	// for that whole object. Descendant coverage cannot hide unknown siblings.
	const otherChanges = state.net.filter(
		(patch) => !isReviewPathCovered(patch.path, coveredPaths),
	);
	return {
		revision: state.revision,
		groups,
		otherChanges: structuredClone(otherChanges),
	};
}
