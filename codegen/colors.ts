/**
 * A map of color context tags to their respective RGB values as hardcoded in the game's code.
 *
 * https://github.com/WeDias/StardewValley/blob/b237fdf9d8b67b079454bb727626fefccc73e15d/Menus/TailoringMenu.cs#L482
 *
 * The colors don't need to be in this exact format, I am just using them for CSS so I did it this way.
 */
export const colorMap = new Map<string, string>([
	["color_gray", "rgb(45, 45, 45)"],
	["color_white", "rgb(255, 255, 255)"],
	["color_pink", "rgb(255, 163, 186)"],
	["color_red", "rgb(220, 0, 0)"],
	["color_orange", "rgb(255, 128, 0)"],
	["color_yellow", "rgb(255, 230, 0)"],
	["color_green", "rgb(10, 143, 0)"],
	["color_blue", "rgb(46, 85, 183)"],
	["color_purple", "rgb(115, 41, 181)"],
	["color_brown", "rgb(130, 73, 37)"],
	["color_light_cyan", "rgb(180, 255, 255)"],
	["color_cyan", "rgb(0, 255, 255)"],
	["color_aquamarine", "rgb(127, 255, 212)"],
	["color_sea_green", "rgb(46, 139, 87)"],
	["color_lime", "rgb(0, 255, 0)"],
	["color_yellow_green", "rgb(173, 255, 47)"],
	["color_pale_violet_red", "rgb(219, 112, 147)"],
	["color_salmon", "rgb(255, 85, 95)"],
	["color_jade", "rgb(130, 158, 93)"],
	["color_sand", "rgb(255, 222, 173)"],
	["color_poppyseed", "rgb(82, 47, 153)"],
	["color_dark_red", "rgb(139, 0, 0)"],
	["color_dark_orange", "rgb(255, 140, 0)"],
	["color_dark_yellow", "rgb(184, 134, 11)"],
	["color_dark_green", "rgb(0, 100, 0)"],
	["color_dark_blue", "rgb(0, 0, 139)"],
	["color_dark_purple", "rgb(148, 0, 211)"],
	["color_dark_pink", "rgb(255, 20, 147)"],
	["color_dark_cyan", "rgb(0, 139, 139)"],
	["color_dark_gray", "rgb(169, 169, 169)"],
	["color_dark_brown", "rgb(139, 69, 19)"],
	["color_gold", "rgb(255, 215, 0)"],
	["color_copper", "rgb(184, 134, 11)"],
	["color_iron", "rgb(197, 213, 224)"],
	["color_iridium", "rgb(105, 15, 255)"],
]);
