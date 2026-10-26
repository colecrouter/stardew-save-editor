import { describe, expect, it } from "vitest";
import {
	generateLocationWeather,
	mapWeatherContext,
} from "../codegen/locationWeather";
import { locationWeatherContext } from "$lib/locationWeather";

const contexts = new Set(["Default", "Island", "Desert"]);
describe("location weather metadata", () => {
	it("reads map properties rather than nested tile properties and ignores invalid context names", () => {
		expect(mapWeatherContext("<map/>", contexts)).toBe("Default");
		expect(
			mapWeatherContext(
				'<map><properties><property name="LocationContext" value="Island"/></properties></map>',
				contexts,
			),
		).toBe("Island");
		expect(
			mapWeatherContext(
				'<map><tileset><tile><properties><property name="LocationContext" value="Island"/></properties></tile></tileset></map>',
				contexts,
			),
		).toBe("Default");
		expect(
			mapWeatherContext(
				'<map><properties><property name="LocationContext" value="Missing"/></properties></map>',
				contexts,
			),
		).toBe("Default");
		expect(() => mapWeatherContext("<tileset/>", contexts)).toThrow(
			"Missing map",
		);
	});
	it("joins creation data to map properties and records the expected save class", async () => {
		const calls: string[] = [];
		const result = await generateLocationWeather(
			{
				IslandNorth: {
					CreateOnLoad: {
						MapPath: "Maps/Island_N",
						Type: "StardewValley.Locations.IslandNorth",
					},
				},
				Dynamic: { CreateOnLoad: null },
				Backwoods: { CreateOnLoad: { MapPath: "Maps/Backwoods", Type: null } },
			},
			contexts,
			async (path) => {
				calls.push(path);
				return path === "Maps/Island_N"
					? '<map><properties><property name="LocationContext" value="Island"/></properties></map>'
					: '<map version="1.4"/>';
			},
		);
		expect(result).toEqual({
			Backwoods: { context: "Default", type: "GameLocation" },
			IslandNorth: { context: "Island", type: "IslandNorth" },
			Farm: { context: "Default", type: "Farm" },
		});
		expect(calls).toEqual(["Maps/Backwoods", "Maps/Island_N", "Maps/Farm"]);
	});
	it("recognizes shipped contexts but conservatively skips unknown names and changed classes", () => {
		expect(
			locationWeatherContext({ name: "Forest", "@_xsi:type": "Forest" }),
		).toBe("Default");
		expect(
			locationWeatherContext({
				name: "IslandWest",
				"@_xsi:type": "IslandWest",
			}),
		).toBe("Island");
		expect(
			locationWeatherContext({ name: "Desert", "@_xsi:type": "Desert" }),
		).toBe("Desert");
		expect(locationWeatherContext({ name: "Backwoods" })).toBe("Default");
		expect(
			locationWeatherContext({ name: "CustomFarm", "@_xsi:type": "Farm" }),
		).toBeUndefined();
		expect(
			locationWeatherContext({ name: "Forest", "@_xsi:type": "CustomForest" }),
		).toBeUndefined();
		expect(locationWeatherContext({ name: "__proto__" })).toBeUndefined();
	});
});
