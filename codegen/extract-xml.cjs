const fs = require("fs");
const path = require("path");

const targets = {
	Item: "StardewValleyDecompiled/Stardew Valley/StardewValley/Item.cs",
	Object: "StardewValleyDecompiled/Stardew Valley/StardewValley/Object.cs",
	Trinket:
		"StardewValleyDecompiled/Stardew Valley/StardewValley.Objects/Trinket.cs",
	Weapon:
		"StardewValleyDecompiled/Stardew Valley/StardewValley.Tools/MeleeWeapon.cs",
	Tool: "StardewValleyDecompiled/Stardew Valley/StardewValley/Tool.cs",
	Hat: "StardewValleyDecompiled/Stardew Valley/StardewValley.Objects/Hat.cs",
	Boots:
		"StardewValleyDecompiled/Stardew Valley/StardewValley.Objects/Boots.cs",
	Clothing:
		"StardewValleyDecompiled/Stardew Valley/StardewValley.Objects/Clothing.cs",
	Ring: "StardewValleyDecompiled/Stardew Valley/StardewValley.Objects/Ring.cs",
	ColoredObject:
		"StardewValleyDecompiled/Stardew Valley/StardewValley/ColoredObject.cs",
};

const workspaceRoot = process.cwd();
const outputDir = path.join(workspaceRoot, "generated");
const outputFile = path.join(outputDir, "xml-element-metadata.json");

/** @type {Record<string, { file: string; baseClass: string | null; fields: any[] }> } */
const metadata = {};

for (const [className, relativePath] of Object.entries(targets)) {
	const fullPath = path.join(workspaceRoot, relativePath.replace(/\\/g, "/"));
	if (!fs.existsSync(fullPath)) {
		console.error(`Missing file for ${className}: ${fullPath}`);
		process.exitCode = 1;
		continue;
	}

	const source = fs.readFileSync(fullPath, "utf8");
	const baseMatch = source.match(/class\s+[a-zA-Z]+\s:\s([a-zA-Z]+)/);
	const baseClass = baseMatch?.[1] ?? null;
	const lines = source.split(/\r?\n/);
	const fields = [];

	let pending = null;

	for (let index = 0; index < lines.length; index += 1) {
		const rawLine = lines[index];
		if (rawLine === undefined) continue;
		const trimmed = rawLine.trim();
		if (!pending) {
			const xmlMatch = trimmed.match(/\[XmlElement\("([^"\]]+)"\)\]/);
			if (xmlMatch) {
				pending = {
					xmlName: xmlMatch[1],
					definition: "",
					line: index + 1,
				};
			}
			continue;
		}

		if (!trimmed) continue;
		pending.definition +=
			(pending.definition ? " " : "") + trimmed.replace(/\s+/g, " ");
		if (
			!trimmed.includes(";") &&
			!trimmed.includes("{") &&
			!trimmed.includes("}")
		) {
			continue;
		}

		const def = pending.definition.replace(/;.*$/, "");
		const defMatch = def.match(
			/(public|protected|internal|private)\s+(?:static\s+)?(?:readonly\s+)?([\w<>[\]]+)\s+([\w_@]+)\s*(=)?/,
		);
		if (!defMatch) {
			console.warn(
				`Could not parse definition for ${className} at ${relativePath}:${pending.line}`,
			);
			pending = null;
			continue;
		}

		const [, , fieldType, fieldName, initializer] = defMatch;
		fields.push({
			xmlName: pending.xmlName,
			fieldName,
			fieldType,
			initializer: Boolean(initializer),
			required: !initializer,
			line: pending.line,
		});
		pending = null;
	}

	metadata[className] = {
		file: relativePath,
		baseClass,
		fields,
	};
}

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputFile, JSON.stringify(metadata, null, 2));
console.log(
	`Extracted XML metadata for ${Object.keys(metadata).length} classes to ${outputFile}`,
);
