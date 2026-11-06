import { XMLParser } from "fast-xml-parser";

export interface LocationWeatherMetadata {
	context: string;
	type: string;
}
interface LocationSource {
	CreateOnLoad?: { MapPath?: string | null; Type?: string | null } | null;
}

/** Only map-level properties determine the context; tile properties don't. */
export function mapWeatherContext(
	xml: string,
	validContexts: ReadonlySet<string>,
): string {
	const parser = new XMLParser({
		ignoreAttributes: false,
		stopNodes: ["map.layer", "map.tileset", "map.objectgroup"],
	});
	const parsed = parser.parse(xml) as {
		map?: {
			properties?: {
				property?:
					| { "@_name"?: string; "@_value"?: string }
					| { "@_name"?: string; "@_value"?: string }[];
			};
		};
	};
	if (!Object.hasOwn(parsed, "map")) throw new Error("Missing map element");
	const properties = parsed.map?.properties?.property;
	const all = properties
		? Array.isArray(properties)
			? properties
			: [properties]
		: [];
	const value = all.find(
		(property) => property["@_name"] === "LocationContext",
	)?.["@_value"];
	// GameLocation.GetLocationContextId ignores invalid properties. Top-level
	// CreateOnLoad locations have no parent, so their fallback is Default.
	return value && validContexts.has(value) ? value : "Default";
}

export async function generateLocationWeather(
	locations: Readonly<Record<string, LocationSource>>,
	validContexts: ReadonlySet<string>,
	loadMap: (path: string) => Promise<string>,
): Promise<Record<string, LocationWeatherMetadata>> {
	const entries: [string, LocationWeatherMetadata][] = [];
	for (const name of Object.keys(locations).sort()) {
		const create = locations[name]?.CreateOnLoad;
		if (!create?.MapPath) continue;
		const context = mapWeatherContext(
			await loadMap(create.MapPath),
			validContexts,
		);
		entries.push([
			name,
			{ context, type: create.Type?.split(".").at(-1) ?? "GameLocation" },
		]);
	}
	// Farm is created separately from Data/Locations.CreateOnLoad.
	entries.push([
		"Farm",
		{
			context: mapWeatherContext(await loadMap("Maps/Farm"), validContexts),
			type: "Farm",
		},
	]);
	return Object.fromEntries(entries);
}
