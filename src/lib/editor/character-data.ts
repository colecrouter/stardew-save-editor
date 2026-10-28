/** Game skill indices and their saved level mirrors (Farmer.getBaseExperienceForLevel). */
export const skillDefinitions = [
	{ key: "farming", label: "Farming", index: 0, levelField: "farmingLevel" },
	{ key: "fishing", label: "Fishing", index: 1, levelField: "fishingLevel" },
	{ key: "foraging", label: "Foraging", index: 2, levelField: "foragingLevel" },
	{ key: "mining", label: "Mining", index: 3, levelField: "miningLevel" },
	{ key: "combat", label: "Combat", index: 4, levelField: "combatLevel" },
] as const;
export type SkillKey = (typeof skillDefinitions)[number]["key"];
export const skillXpForLevel = [
	0, 100, 380, 770, 1300, 2150, 3300, 4800, 6900, 10000, 15000,
] as const;
export const masteryXpForLevel = [
	0, 10000, 25000, 45000, 70000, 100000,
] as const;
const professionNames = [
	"Rancher",
	"Tiller",
	"Coopmaster",
	"Shepherd",
	"Artisan",
	"Agriculturist",
	"Fisher",
	"Trapper",
	"Angler",
	"Pirate",
	"Mariner",
	"Luremaster",
	"Forester",
	"Gatherer",
	"Lumberjack",
	"Tapper",
	"Botanist",
	"Tracker",
	"Miner",
	"Geologist",
	"Blacksmith",
	"Prospector",
	"Excavator",
	"Gemologist",
	"Fighter",
	"Scout",
	"Brute",
	"Defender",
	"Acrobat",
	"Desperado",
] as const;
// The game resolves these professions through Strings/UI keys
// LevelUp_ProfessionName_<name> and LevelUp_ProfessionDescription_<name>.
// These are editor-authored short summaries, retained until that asset is part of
// code generation. Keep each summary keyed by name rather than a parallel ID map.
const professionDescriptions = {
	Rancher: "Animal products sell for more.",
	Tiller: "Crops sell for more.",
	Coopmaster: "Befriend coop animals faster; incubate eggs faster.",
	Shepherd: "Befriend barn animals faster; sheep grow wool faster.",
	Artisan: "Artisan goods sell for more.",
	Agriculturist: "Crops grow faster.",
	Fisher: "Fish sell for more.",
	Trapper: "Crab pots cost fewer resources to craft.",
	Angler: "Fish sell for more.",
	Pirate: "Find more treasure while fishing.",
	Mariner: "Crab pots no longer catch trash.",
	Luremaster: "Crab pots no longer need bait.",
	Forester: "Trees yield more wood.",
	Gatherer: "Chance to collect double forage.",
	Lumberjack: "All trees can drop hardwood.",
	Tapper: "Syrups sell for more.",
	Botanist: "Foraged items have the highest quality.",
	Tracker: "Reveals nearby forage locations.",
	Miner: "Ore veins yield extra ore.",
	Geologist: "Chance for gems to appear in pairs.",
	Blacksmith: "Metal bars sell for more.",
	Prospector: "Find more coal.",
	Excavator: "Find more geodes.",
	Gemologist: "Gems sell for more.",
	Fighter: "Deal more damage and gain health.",
	Scout: "Critical strikes happen more often.",
	Brute: "Deal more damage.",
	Defender: "Gain more health.",
	Acrobat: "Special moves recharge faster.",
	Desperado: "Critical strikes deal more damage.",
} satisfies Record<(typeof professionNames)[number], string>;

/** The six professions for each skill contain two parents and four branch choices. */
export const professionDefinitions = skillDefinitions.flatMap((definition) =>
	professionNames
		.slice(definition.index * 6, definition.index * 6 + 6)
		.map((name, offset) => ({
			id: definition.index * 6 + offset,
			name,
			description: professionDescriptions[name],
			skill: definition.key,
			...(offset >= 2
				? { parent: definition.index * 6 + (offset >= 4 ? 1 : 0) }
				: {}),
		})),
);
