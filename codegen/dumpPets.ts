import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { generatePetAppearances } from "./pets.ts";

// Keep game content out of application imports. The committed lookup makes
// normal development/CI independent of an installed copy of Stardew Valley.
const source: unknown = JSON.parse(
	await readFile("content/Data/Pets.json", "utf8"),
);
const appearances = generatePetAppearances(source);
await mkdir("generated", { recursive: true });
await mkdir("static/assets", { recursive: true });
await writeFile(
	"generated/pets.json",
	`${JSON.stringify(appearances, null, "\t")}\n`,
);
// The older cursor sheet is already copied by the full dump; copying both here
// keeps the focused generator reproducible on its own.
for (const name of ["Cursors", "Cursors_1_6"])
	await copyFile(
		`content/LooseSprites/${name}.png`,
		`static/assets/${name}.png`,
	);
