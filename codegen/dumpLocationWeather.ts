import { readFile, writeFile } from "node:fs/promises";
import locations from "../content/Data/Locations.json" with { type: "json" };
import contexts from "../content/Data/LocationContexts.json" with { type: "json" };
import { generateLocationWeather } from "./locationWeather.ts";

const metadata = await generateLocationWeather(
	locations,
	new Set(Object.keys(contexts)),
	(path) => {
		const normalized = path.replaceAll("\\", "/");
		if (!normalized.startsWith("Maps/") || normalized.split("/").includes(".."))
			throw new Error(`Unexpected game map path: ${path}`);
		return readFile(`content/${normalized}.tmx`, "utf8");
	},
);
await writeFile(
	"generated/location-weather.json",
	`${JSON.stringify(metadata, null, "\t")}\n`,
);
