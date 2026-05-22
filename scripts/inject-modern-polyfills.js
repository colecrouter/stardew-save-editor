import fs from "node:fs";
import path from "node:path";

const buildDir = path.resolve("build");
const immutableDir = path.join(buildDir, "_app", "immutable");

if (!fs.existsSync(immutableDir)) {
	console.log("No SvelteKit immutable output found; skipping polyfill injection.");
	process.exit(0);
}

const polyfills = fs
	.readdirSync(immutableDir)
	.filter((file) => /^polyfills\..+\.js$/.test(file));

if (polyfills.length === 0) {
	console.log("No modern polyfill chunk emitted; skipping polyfill injection.");
	process.exit(0);
}

if (polyfills.length > 1) {
	throw new Error(
		`Expected one modern polyfill chunk, found ${polyfills.length}: ${polyfills.join(", ")}`,
	);
}

const polyfillPath = path.join(immutableDir, polyfills[0]);

const findHtmlFiles = (directory) => {
	const files = [];
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const entryPath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...findHtmlFiles(entryPath));
		} else if (entry.isFile() && entry.name.endsWith(".html")) {
			files.push(entryPath);
		}
	}
	return files;
};

const htmlFiles = findHtmlFiles(buildDir);

let injected = 0;

for (const htmlFile of htmlFiles) {
	const html = fs.readFileSync(htmlFile, "utf8");
	if (html.includes(polyfills[0])) continue;

	const htmlDir = path.dirname(htmlFile);
	let polyfillImport = path
		.relative(htmlDir, polyfillPath)
		.split(path.sep)
		.join("/");

	if (!polyfillImport.startsWith(".")) {
		polyfillImport = `./${polyfillImport}`;
	}

	const updated = html.replace(
		/Promise\.all\(\[\s*import\("(?<start>[^"]+\/entry\/start\.[^"]+\.js)"\),\s*import\("(?<app>[^"]+\/entry\/app\.[^"]+\.js)"\)\s*\]\)\.then\(\(\[kit, app\]\) => \{/,
		(_, start, app) => `import("${polyfillImport}").then(() => Promise.all([
						import("${start}"),
						import("${app}")
					])).then(([kit, app]) => {`,
	);

	if (updated === html) {
		throw new Error(`Could not find SvelteKit startup imports in ${htmlFile}`);
	}

	fs.writeFileSync(htmlFile, updated);
	injected++;
}

if (injected === 0) {
	console.log("Modern polyfill import already present in generated HTML.");
} else {
	console.log(`Injected modern polyfill import into ${injected} HTML files.`);
}
