// The XML parser has no idea what should be an array and what should be an object
// This isn't a huge deal, but we can make it a little easier to work with by
// supplying a list of things we want to be arrays
export const arrayTags = new Set([
	"item",
	"GameLocations",
	"characters",
	// "objects",
	"Farmer",
]);
export const nestedArrayTags = new Map<string, string[]>([
	[
		"int",
		[
			"professions",
			"experiencePoints",
			"eventsSeen",
			"secretNotesSeen",
			"achievements",
		],
	],
	// Ensure single-element bundle submission arrays (ArrayOfBoolean.boolean) stay arrays
	[
		"boolean",
		[
			"ArrayOfBoolean", // covers bundles submission boolean arrays
		],
	],
	[
		"string",
		[
			"mailReceived",
			"mailForTomorrow",
			"mailbox",
			"triggerActionsRun",
			"songsHeard",
			"locationsVisited",
		],
	],
	[
		"item",
		[
			"cookingRecipes",
			"craftingRecipes",
			"activeDialogueEvents",
			"previousActiveDialogueEvents",
			"friendshipData",
			"basicShipped",
			"mineralsFound",
			"recipesCooked",
			"fishCaught",
			"archaeologyFound",
			"giftedItems",
			"tailoredItems",
			"chestConsumedLevels",
		],
	],
]);
