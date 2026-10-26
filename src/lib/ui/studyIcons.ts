import type atlas from "./art/icon-regions.json";

// Code-native action and season glyphs outside the illustrated raster kit.
export const studyIcons = {
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
export type StudyIconName =
	| keyof typeof studyIcons
	| keyof typeof atlas.regions;
