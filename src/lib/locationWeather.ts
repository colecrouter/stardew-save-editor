import generated from "$generated/location-weather.json";

const metadata: Readonly<Record<string, { context: string; type: string }>> =
	generated;

/** Unknown names or changed location classes have no safe vanilla context inference. */
export function locationWeatherContext(location: {
	name: string;
	"@_xsi:type"?: string;
}): string | undefined {
	const known = Object.hasOwn(metadata, location.name)
		? metadata[location.name]
		: undefined;
	return known?.type === (location["@_xsi:type"] ?? "GameLocation")
		? known.context
		: undefined;
}
