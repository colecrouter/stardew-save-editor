/**
    The test save's Pickaxe, as the Copper Pickaxe (or another `itemId`, such
    as `CopperTrashCan`) that Clint is upgrading, with `days` left
*/
export const withToolAtClint = (
	xml: string,
	days: number,
	itemId = "CopperPickaxe",
) => {
	const player = xml.slice(xml.indexOf("<player>"), xml.indexOf("</player>"));
	const at = player.indexOf('<Item xsi:type="Pickaxe">');
	const pickaxe = player.slice(at, player.indexOf("</Item>", at));
	const tool = pickaxe
		.replace(
			'<Item xsi:type="Pickaxe">',
			'<toolBeingUpgraded xsi:type="Pickaxe">',
		)
		.replace("<itemId>Pickaxe</itemId>", `<itemId>${itemId}</itemId>`)
		.replace(
			"<upgradeLevel>0</upgradeLevel>",
			"<upgradeLevel>1</upgradeLevel>",
		);
	return xml.replace(
		"<daysLeftForToolUpgrade>0</daysLeftForToolUpgrade>",
		`${tool}</toolBeingUpgraded><daysLeftForToolUpgrade>${days}</daysLeftForToolUpgrade>`,
	);
};

/** The main player's house at `level`, with Robin's countdown at `days` (-1 for none) */
export const withHouse = (xml: string, level: number, days = -1) =>
	xml
		.replace(
			"<houseUpgradeLevel>0</houseUpgradeLevel>",
			`<houseUpgradeLevel>${level}</houseUpgradeLevel>`,
		)
		.replace(
			"<daysUntilHouseUpgrade>-1</daysUntilHouseUpgrade>",
			`<daysUntilHouseUpgrade>${days}</daysUntilHouseUpgrade>`,
		);
