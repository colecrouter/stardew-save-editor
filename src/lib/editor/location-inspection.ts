import type { Location, SaveDocument } from "./domain.ts";
import { isKnownLocation, savedType } from "./saved-types.ts";

interface LocationInspection {
	id: string;
	name: string;
	readable: boolean;
	objects: {
		index: number;
		x?: number | undefined;
		y?: number | undefined;
		name: string;
		type: string;
	}[];
}

export function readLocations(document: SaveDocument): LocationInspection[] {
	const locations: LocationInspection[] = [];
	function visit(location: Location | null, id: string, parent?: string) {
		// The path identifies one saved record even when interiors share map names.
		// Keep opaque locations in the list without attempting to decode their data.
		if (!isKnownLocation(location)) {
			locations.push({
				id,
				name:
					parent === undefined
						? "Unknown location"
						: `${parent} / Unknown interior`,
				readable: false,
				objects: [],
			});
			return;
		}
		const name = location.uniqueName ?? location.name ?? "Unnamed location";
		const label = parent === undefined ? name : `${parent} / ${name}`;
		locations.push({
			id,
			name: label,
			readable: location.objects !== undefined,
			// The dictionary key supplies the saved tile coordinate. Keep missing
			// values visible as unknown rather than guessing from the object payload.
			objects: (location.objects ?? []).map(({ key, value }, index) => ({
				index,
				x: key.X,
				y: key.Y,
				name:
					value.$type === "$unknown"
						? "Unknown object"
						: (value.name ?? value.itemId ?? "Unnamed object"),
				type:
					value.$type === "$unknown"
						? "Unknown type"
						: (savedType(value) ?? "Object"),
			})),
		});
		for (const [index, building] of (location.buildings ?? []).entries()) {
			if (building && building.$type !== "$unknown" && building.indoors)
				visit(building.indoors, `${id}/${index}`, label);
		}
	}
	for (const [index, location] of (document.SaveGame.locations ?? []).entries())
		visit(location, String(index));
	return locations;
}
