// Original, small-grid UI pictograms. Each is drawn for its displayed size,
// rather than reducing a full building sprite or reusing a game-menu tab.
const barn = [
	["#49230f", "M2 9h2V7h2V5h3V3h6v2h3v2h2v2h2v13H2z"],
	["#c95e2c", "M4 10h16v10H4zM6 8h12v2H6zM9 5h6v3H9z"],
	["#f9dc91", "M4 11h16v2H4zM5 13h2v7H5zM17 13h2v7h-2zM9 6h6v4H9z"],
	["#5e321b", "M9 14h6v6H9zM10 7h4v2h-4z"],
	[
		"#f4bd67",
		"M9 14h1v1h1v1h2v-1h1v-1h1v2h-1v1h-1v1h1v1h1v1h-2v-1h-2v1H9v-1h1v-1h1v-1h-1v-1H9z",
	],
] as const;
const face = [
	["#39291e", "M6 3h12v2h2v15h-3v2H7v-2H4V5h2z"],
	["#bf702e", "M6 5h12v5H6z"],
	["#f6c183", "M6 11h12v7h-2v2H8v-2H6z"],
	["#39291e", "M8 12h2v2H8zM14 12h2v2h-2zM10 17h4v1h-4z"],
	["#56a7d0", "M4 18h3v3h10v-3h3v5H4z"],
] as const;
const cloud = [
	["#3d4c70", "M7 3h9v2h3v3h3v8H2V8h3V5h2z"],
	["#7ca6c5", "M8 5h7v2h3v3h2v4H4v-4h3V7h1z"],
	["#b7d1d4", "M8 6h6v2H8zM5 10h3v2H5z"],
] as const;
export const studyIcons = {
	rain: [
		...cloud,
		["#3b80b9", "M5 17h2v4H5zM11 18h2v5h-2zM17 17h2v4h-2z"],
		["#9bd8eb", "M5 17h1v2H5zM11 18h1v3h-1zM17 17h1v2h-1z"],
	],
	storm: [...cloud, ["#eeb94a", "M11 14h5l-3 4h3l-7 6 2-6H8z"]],
	snow: [...cloud, ["#e9f4f0", "M5 17h2v2H5zM11 20h2v2h-2zM17 17h2v2h-2z"]],
	wind: [
		[
			"#7d9159",
			"M2 6h15V4h3v2h2v3h-2v2H8V9h11V8H2zM3 14h12v2h4v4h-3v-2H5v-2H3z",
		],
		["#c19046", "M2 10h4v2h2v2H4v-2H2zM15 1h4v2h-4z"],
	],
	farm: barn,
	buildings: [
		["#522913", "M1 10h2V8h2V6h3V4h8v2h3v2h2v2h2v2h-3v10H4V12H1z"],
		["#e9a64b", "M5 10h14v11H5zM8 7h8v3H8z"],
		["#aa4b26", "M2 10h3V8h3V6h8v2h3v2h3v2H2z"],
		["#61371c", "M10 14h5v7h-5z"],
		["#ffe2a0", "M6 13h3v4H6zM16 13h2v4h-2z"],
	],
	inventory: [
		["#4f2b13", "M8 2h8v3h3v3h2v14H3V8h2V5h3z"],
		["#e6a340", "M9 4h6v3H9zM6 8h12v12H6zM4 11h2v8H4zM18 11h2v8h-2z"],
		["#a65d20", "M6 9h12v3H6zM7 15h10v5H7z"],
		["#ffe1a0", "M10 10h4v4h-4z"],
	],
	chests: [
		["#3d2c18", "M3 5h18v3h1v13H2V8h1z"],
		["#cf8734", "M4 7h16v12H4z"],
		["#f3bc65", "M4 7h16v4H4zM4 17h16v2H4z"],
		["#5b5534", "M5 7h2v12H5zM17 7h2v12h-2zM3 11h18v2H3z"],
		["#fbe29c", "M10 10h4v5h-4z"],
		["#514528", "M11 12h2v2h-2z"],
	],
	character: face,
	farmhands: face,
	relationships: [
		[
			"#63242a",
			"M4 4h6v2h4V4h6v2h2v8h-2v2h-2v2h-2v2h-2v2h-4v-2H8v-2H6v-2H4v-2H2V6h2z",
		],
		["#ef5260", "M4 6h6v2h4V6h6v7h-2v2h-2v2h-2v2h-4v-2H8v-2H6v-2H4z"],
		["#ffb5a9", "M5 7h4v2H5zM5 9h2v3H5z"],
	],
	appearance: [
		["#29395d", "M7 3h3v2h4V3h3l6 5-4 6-3-2v10H8V12l-3 2-4-6z"],
		["#5585da", "M7 5h2v2h6V5h2l4 4-2 3-3-3v11H8V9l-3 3-2-3z"],
		["#a9d7ff", "M9 8h2v10H9zM5 7h2v2H5z"],
	],
	crafting: [
		["#503222", "M4 2h11v3h4v7h-5V9h-3v3H8V9H4zM9 12h5v10H9z"],
		["#9faeb4", "M5 3h9v3h4v4h-3V7h-5v4H8V8H5z"],
		["#cf8b40", "M10 12h3v9h-3z"],
	],
	cooking: [
		["#3d3020", "M2 9h3V7h14v2h3v6h-3v4H5v-4H2zM9 3h6v2H9z"],
		["#538fc0", "M5 9h14v7h-2v2H7v-2H5z"],
		["#b7dce1", "M5 8h14v3H5zM7 12h2v3H7z"],
		["#d8a752", "M2 10h3v3H2zM19 10h3v3h-3zM8 6h8v2H8z"],
	],
	events: [
		["#573119", "M5 2h15v19H4V4h1z"],
		["#e79a45", "M6 3h13v17H6z"],
		["#ffe1a2", "M8 5h9v12H8z"],
		["#a44c28", "M10 7h5v2h-5zM9 11h7v1H9zM9 14h6v1H9z"],
	],
	quests: [
		["#60401d", "M5 2h14v3h2v16H3V5h2z"],
		["#edbd58", "M5 4h14v15H5z"],
		["#fff0bd", "M6 5h12v12H6z"],
		["#964a24", "M11 6h3v6h-3zM11 14h3v2h-3z"],
	],
	community: [
		["#8f4a15", "M10 1h4v6h7v4h-3v4h-2v7h-4v-3H9v3H5v-7H3v-4H1V7h9z"],
		["#f5b62b", "M11 3h2v6h7v1h-4v4h-2v5h-1v-3h-3v2H7v-5H5v-3H3V9h8z"],
		["#ffe18b", "M11 5h2v5h-2zM5 10h5v2H5z"],
	],
	qi: [
		["#343251", "M9 2h7v3h4v4h2v7h-3v3h-4v3H8v-3H4v-4H2V8h3V5h4z"],
		["#5572b4", "M9 4h6v3h4v8h-3v3h-3v2H9v-3H6v-3H4V9h3V7h2z"],
		["#a8c9ed", "M10 5h3v4h-3zM7 8h3v4H7z"],
		["#f4dfb6", "M11 11h3v5h-3z"],
	],
	tree: [
		["#603b1b", "M10 2h4v3h2v3h3v4h3v5h-7v6H9v-6H2v-5h3V8h3V5h2z"],
		["#3f7950", "M10 4h4v4h3v4h3v3H4v-3h3V8h3z"],
		["#8ab661", "M10 5h2v3h-2zM7 10h4v2H7z"],
		["#c48c45", "M10 17h4v5h-4z"],
	],
	save: [
		["#302e55", "M3 2h16v2h2v18H3z"],
		["#6789cd", "M5 4h13v2h1v14H5z"],
		["#e9e4d2", "M7 3h9v7H7zM7 14h10v6H7z"],
		["#3e4f79", "M12 4h3v5h-3zM9 16h6v1H9zM9 18h6v1H9z"],
	],
	exit: [
		[
			"#fff1d2",
			"M6 5h3v3h2v2h2V8h2V5h3v4h-2v2h-2v2h2v2h2v4h-3v-3h-2v-2h-2v2H9v3H6v-4h2v-2h2v-2H8V9H6z",
		],
	],
	info: [
		["#23548b", "M7 2h10v2h3v3h2v10h-2v3h-3v2H7v-2H4v-3H2V7h2V4h3z"],
		["#5b9dd8", "M7 4h10v2h3v12h-3v2H7v-2H4V6h3z"],
		["#e9f3e8", "M11 6h3v3h-3zM10 11h4v7h-3v-5h-1z"],
	],
	spring: [
		["#58804a", "M11 11h2v11h-2zM13 16h5v2h-5z"],
		["#c85e87", "M9 2h6v4h5v6h-5v4H9v-4H4V6h5z"],
		["#f7b6b7", "M10 3h4v5h5v3h-5v4h-4v-4H5V8h5z"],
		["#f5d16a", "M10 8h4v4h-4z"],
	],
	summer: [
		["#aa651f", "M9 1h6v4h4v4h4v6h-4v4h-4v4H9v-4H5v-4H1V9h4V5h4z"],
		["#f3b835", "M9 3h6v4h4v10h-4v4H9v-4H5V7h4z"],
		["#ffe5a0", "M9 7h6v2H9zM7 9h2v6H7z"],
	],
	fall: [
		["#8c4827", "M12 2h3v4h5v6h-3v4h-4v6h-2v-7H7v-3H3V7h6V4h3z"],
		["#d8893d", "M12 5h2v3h4v3h-4v3h-3v-2H8V9H5V8h6V6h1z"],
	],
	winter: [
		[
			"#6b9bb3",
			"M11 1h2v6h3V4h2v5h5v2h-7v2h7v2h-5v5h-2v-3h-3v6h-2v-6H8v3H6v-5H1v-2h7v-2H1V9h5V4h2v3h3z",
		],
		["#d7f3ed", "M11 8h2v3h3v2h-3v3h-2v-3H8v-2h3z"],
	],
} as const satisfies Record<string, readonly (readonly [string, string])[]>;
export type StudyIconName = keyof typeof studyIcons;
