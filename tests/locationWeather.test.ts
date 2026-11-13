import { describe, expect, it } from "vitest";
import { locationWeatherContext } from "$lib/locationWeather";

// Map extraction cases now run against the .NET generator. These assertions
// retain the browser's conservative interpretation of the generated catalog.
describe("location weather metadata", () => {
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
