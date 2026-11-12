import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// All generated modules are disposable test output. Build the real CLI once,
// then compile the small catalog corpus through the public command boundary.
function run(command, args) {
	const result = spawnSync(command, args, { encoding: "utf8" });
	if (result.status !== 0) throw new Error(result.stdout + result.stderr);
	return result.stdout;
}
const destination = resolve("tools/game-data/tests/generated");
mkdirSync(destination, { recursive: true });
run("dotnet", ["build", "tools/game-data", "--nologo", "--verbosity", "quiet"]);
const cli = resolve("tools/game-data/bin/Debug/net10.0/GameData.dll");
const fixtures = resolve("tools/game-data/tests/fixtures");
for (const filename of readdirSync(fixtures).filter((name) =>
	name.endsWith(".catalog.json"),
)) {
	const input = resolve(fixtures, filename);
	const catalog = JSON.parse(readFileSync(input, "utf8"));
	const root = catalog.types.find(
		(type) => type.kind === "object" && !type.customXml,
	)?.id;
	if (!root) throw new Error(`No fixture root in ${filename}`);
	const name = filename.replace(".catalog.json", "");
	run("dotnet", [
		cli,
		"generate",
		"--catalog",
		input,
		"--type",
		root,
		"--output",
		resolve(destination, `${name}.ts`),
	]);
}
// The synthetic game proves reflection, generation and .NET XmlSerializer agree
// without requiring copyrighted game assemblies in CI.
run("dotnet", [
	"build",
	"tools/game-data/tests/game",
	"--output",
	resolve(destination, "game"),
	"--nologo",
	"--verbosity",
	"quiet",
]);
run("dotnet", [
	cli,
	"inspect",
	"--game-path",
	resolve(destination, "game"),
	"--output",
	resolve(destination, "fixture.catalog.json"),
]);
run("dotnet", [
	cli,
	"generate",
	"--game-path",
	resolve(destination, "game"),
	"--output",
	resolve(destination, "fixture.ts"),
]);
writeFileSync(
	resolve(destination, "fixture.xml"),
	run("dotnet", [resolve(destination, "game/Stardew Valley.dll"), "write"]),
);
