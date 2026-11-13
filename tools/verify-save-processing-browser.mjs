import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { isDeepStrictEqual } from "node:util";
import { chromium } from "playwright";
import { Schema } from "effect";
import { XmlSchema } from "../generated/save-format/save.ts";
// Drive import and export against production preview with real browser workers. Keep this
// separate from happy-dom tests: worker transfer and termination need a browser.
const argument = (name, fallback) => {
	const index = process.argv.indexOf(name);
	return index < 0 ? fallback : process.argv[index + 1];
};
const url = argument("--url", "http://127.0.0.1:4269/stardew-save-editor/");
const output = argument("--output", undefined);
// CI installs Playwright Chromium. Developers can select an installed browser
// with --channel chrome or --chromium /path/to/chromium without changing the flow.
const browser = await chromium.launch({
	channel: argument("--channel", undefined),
	executablePath: argument("--chromium", undefined),
	headless: true,
});
const decodeSave = Schema.decodeUnknownSync(XmlSchema);
const encodeSave = Schema.encodeSync(XmlSchema);
const bytes = readFileSync(new URL("../tests/TestSave", import.meta.url));
const evidence = {};
let page;
try {
	page = await browser.newPage();
	page.setDefaultTimeout(30_000);
	const errors = [];
	page.on("pageerror", (e) => errors.push(e.message));
	await page.route(/sentry\.io/, (route) => route.abort());
	// Accept a destination without writing to disk. Every recorded write therefore
	// proves the application got through worker export and validation successfully.
	await page.addInitScript(() => {
		window.writes = [];
		window.holdImport = true;
		window.heldImports = [];
		window.importSources = [];
		window.workerLifetimes = [];
		window.startupAttempts = [];
		// Track reads per original File. Import must post the Blob before any
		// main-thread arrayBuffer read; optional backup reads happen separately later.
		window.fileReads = new WeakMap();
		// oxlint-disable-next-line typescript/unbound-method
		const read = File.prototype.arrayBuffer;
		File.prototype.arrayBuffer = function () {
			window.fileReads.set(this, (window.fileReads.get(this) ?? 0) + 1);
			return read.call(this);
		};
		// Hold requests at the real transport boundary to make pending phases
		// deterministic, then delegate to native postMessage for transfer proof.
		const NativeWorker = window.Worker;
		window.Worker = class extends NativeWorker {
			constructor(script, options) {
				// SDKs can create their own workers. Inject faults and track ownership
				// only for the application's save-processing endpoint.
				const saveWorker = String(script).includes("save-processing");
				const failure = saveWorker ? window.failWorkerStartup : undefined;
				if (saveWorker) {
					window.failWorkerStartup = undefined;
					window.startupAttempts.push({ failure });
				}
				if (failure === "constructor")
					throw new DOMException(
						"Intentional worker constructor failure",
						"SecurityError",
					);
				super(
					failure === "module"
						? new URL("__missing_save_worker__.js", location.href)
						: script,
					options,
				);
				if (saveWorker) {
					this.lifetime = { terminated: false };
					window.workerLifetimes.push(this.lifetime);
				}
			}
			terminate() {
				if (this.lifetime) this.lifetime.terminated = true;
				return super.terminate();
			}
			postMessage(message, options) {
				const request = message?.[0] === 0 ? message[1] : undefined;
				if (request?.tag === "importBlob" && window.holdImport) {
					window.heldImports.push({ worker: this, message, options });
					return;
				}
				if (request?.tag === "exportSave" && window.holdExport) {
					window.releaseExport = () => super.postMessage(message, options);
					return;
				}
				const buffers = (
					Array.isArray(options) ? options : (options?.transfer ?? [])
				).filter((value) => value instanceof ArrayBuffer);
				const before = buffers.map((value) => value.byteLength);
				super.postMessage(message, options);
				if (request?.tag === "importBlob")
					window.importSources.push({
						before,
						after: buffers.map((value) => value.byteLength),
						blobSize: request.payload.blob.size,
						mainReads: window.fileReads.get(request.payload.blob) ?? 0,
					});
			}
		};
		window.showSaveFilePicker = async () => {
			if (window.holdPicker)
				await new Promise((resolve) => {
					window.releasePicker = resolve;
				});
			return {
				createWritable: async () => ({
					write: async (b) => {
						if (window.holdWrite) {
							window.writeStarted = true;
							await new Promise((resolve) => {
								window.releaseWrite = resolve;
							});
						}
						window.writes.push(await b.text());
					},
					close: async () => {},
					abort: async () => {},
				}),
			};
		};
	});
	await page.goto(url);
	const choose = async (buffer) => {
		await page.getByLabel("Save file", { exact: true }).setInputFiles({
			name: "ProbeFarm",
			mimeType: "application/octet-stream",
			buffer,
		});
	};
	const load = async (buffer) => {
		await choose(buffer);
		await page
			.getByRole("button", { name: "Export save", exact: true })
			.waitFor({ timeout: 120000 });
	};
	const checkCompactPhase = async (name) => {
		const originalViewport = page.viewportSize();
		await page.setViewportSize({ width: 390, height: 900 });
		assert(await page.getByText(name, { exact: true }).isVisible());
		assert(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= innerWidth,
			),
			"Loading feedback must not create horizontal overflow",
		);
		if (output)
			await page.screenshot({
				path: `${output}.${name.startsWith("Opening") ? "import" : "export"}-mobile.png`,
			});
		await page.setViewportSize(originalViewport);
	};
	// Startup failures must release their partially acquired scopes, restore the
	// upload screen, and allow a new worker/session on the very next attempt.
	evidence.startupFailures = [];
	await page.evaluate(() => {
		window.holdImport = false;
	});
	for (const failure of ["constructor", "module"]) {
		await page.evaluate((failure) => {
			window.failWorkerStartup = failure;
		}, failure);
		await choose(bytes);
		await page
			.getByText(/The save could not be (opened|processed)/)
			.waitFor({ timeout: 10000 });
		assert(await page.getByLabel("Save file", { exact: true }).isEnabled());
		assert.equal(
			await page
				.getByRole("button", { name: "Export save", exact: true })
				.count(),
			0,
		);
		assert(
			await page.evaluate(() =>
				window.workerLifetimes.every((worker) => worker.terminated),
			),
		);
		await load(bytes);
		await page.getByRole("button", { name: "Exit", exact: true }).click();
		await page.getByLabel("Save file", { exact: true }).waitFor();
		assert(
			await page.evaluate(() =>
				window.workerLifetimes.every((worker) => worker.terminated),
			),
		);
		evidence.startupFailures.push({
			failure,
			retry: true,
			workersReleased: true,
		});
	}
	await page.evaluate(() => {
		window.holdImport = true;
	});
	// Cancel before a session is installed. The loading UI must remain responsive,
	// disable duplicate input, and terminate the pending import's dedicated worker.
	await choose(bytes);
	await page.waitForFunction(() => window.heldImports.length > 0);
	assert(await page.getByLabel("Save file", { exact: true }).isDisabled());
	await page.getByText("Opening save…", { exact: true }).waitFor();
	if (output) await page.screenshot({ path: `${output}.loading.png` });
	await checkCompactPhase("Opening save…");
	const importingWorker = page
		.workers()
		.find((worker) => worker.url().includes("save-processing"));
	assert(importingWorker);
	const importClosed = new Promise((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new Error("Import worker survived cancellation")),
			10000,
		);
		importingWorker.once("close", () => {
			clearTimeout(timer);
			resolve();
		});
	});
	await page
		.getByRole("button", { name: "Cancel import", exact: true })
		.click();
	await importClosed;
	assert(await page.getByLabel("Save file", { exact: true }).isEnabled());
	assert.equal(
		await page
			.getByRole("button", { name: "Export save", exact: true })
			.count(),
		0,
	);
	await page.evaluate(() => {
		window.holdImport = false;
		window.heldImports = [];
	});
	evidence.importCancellation = true;
	await choose(Buffer.from("broken XML"));
	await page
		.getByText(/This file could not be read as a Stardew Valley save/)
		.waitFor();
	assert(await page.getByLabel("Save file", { exact: true }).isEnabled());
	evidence.importFailureRecovered = true;
	// Exercise decompression as well as XML decode, then reuse this file's worker
	// for export. Import must clone the original Blob without eagerly reading it.
	await load(deflateSync(bytes));
	const importedWorker = page
		.workers()
		.find((worker) => worker.url().includes("save-processing"));
	evidence.importSources = await page.evaluate(() => window.importSources);
	assert(
		evidence.importSources.some(
			(item) =>
				item.before.length === 0 &&
				item.after.length === 0 &&
				item.blobSize > 0 &&
				item.mainReads === 0,
		),
	);
	await page.evaluate(() => {
		window.holdPicker = true;
	});
	await page.getByRole("button", { name: "Export save", exact: true }).click();
	await page.getByText("Choose where to save…", { exact: true }).waitFor();
	await page.evaluate(() => {
		window.holdPicker = false;
		window.releasePicker();
	});
	await page.waitForFunction(() => window.writes.length === 1);
	await page.evaluate(() => (window.writes = []));
	const worker = page
		.workers()
		.find((w) => w.url().includes("save-processing"));
	assert.equal(
		worker,
		importedWorker,
		"Import and export must share one file-owned worker",
	);
	assert(worker, "Missing save worker");
	await worker.evaluate(() => {
		self.transferChecks = [];
		const original = self.postMessage.bind(self);
		self.postMessage = (message, options) => {
			const buffers = (options?.transfer ?? []).filter(
				(x) => x instanceof ArrayBuffer,
			);
			const check = { before: buffers.map((x) => x.byteLength) };
			original(message, options);
			if (buffers.length) {
				check.after = buffers.map((x) => x.byteLength);
				self.transferChecks.push(check);
			}
		};
	});
	await page.evaluate(() => {
		window.holdExport = true;
		window.holdWrite = true;
	});
	await page.getByRole("button", { name: "Export save", exact: true }).click();
	await page.waitForFunction(() => !!window.releaseExport);
	await page.getByText("Preparing save…", { exact: true }).waitFor();
	if (output) await page.screenshot({ path: `${output}.preparing.png` });
	await checkCompactPhase("Preparing save…");
	assert(
		await page
			.getByRole("button", { name: "Export save", exact: true })
			.isDisabled(),
	);
	await page.evaluate(() => {
		window.holdExport = false;
		window.releaseExport();
	});
	await page.waitForFunction(() => window.writeStarted);
	await page.getByText("Writing save…", { exact: true }).waitFor();
	await page.evaluate(() => {
		window.holdWrite = false;
		window.releaseWrite();
	});
	await page.waitForFunction(() => window.writes.length === 1);
	evidence.loadingPhases = true;
	// Compare every decoded value, including bigint IDs and unknown fields. XML
	// declarations, formatting and namespace placement are intentionally canonical.
	// Keep assertion failures compact instead of dumping the complete save into CI.
	assert.ok(
		isDeepStrictEqual(
			decodeSave(await page.evaluate(() => window.writes[0])),
			decodeSave(new TextDecoder().decode(bytes)),
		),
		"Worker export changed the decoded save",
	);
	evidence.transfer = await worker.evaluate(() => self.transferChecks);
	assert(evidence.transfer.some((x) => x.before[0] > 0 && x.after[0] === 0));
	evidence.exactPreservation = true;
	// A blocked response is real pending worker work. Exit must terminate it and
	// suppress all writes, instead of retaining a worker until its CPU task ends.
	await worker.evaluate(() => {
		const original = self.postMessage.bind(self);
		self.heldResponses = 0;
		self.responseHeld = new Promise((resolve) => {
			self.resolveHeldResponse = resolve;
		});
		self.postMessage = (message, options) => {
			if (options?.transfer?.some((x) => x instanceof ArrayBuffer)) {
				self.heldResponses++;
				self.resolveHeldResponse();
				return;
			}
			original(message, options);
		};
	});
	await page.getByRole("button", { name: "Export save", exact: true }).click();
	await page.waitForFunction(
		() => document.querySelector('button[aria-label="Export save"]')?.disabled,
	);
	// Wait for the response we deliberately intercepted, rather than assuming a
	// full typed XML export finishes within a fixed five-second polling window.
	await worker.evaluate(
		() =>
			new Promise((resolve, reject) => {
				const timer = setTimeout(
					() => reject(new Error("Export did not reach the held response")),
					30_000,
				);
				self.responseHeld.then(() => {
					clearTimeout(timer);
					resolve();
				});
			}),
	);
	assert((await worker.evaluate(() => self.heldResponses)) > 0);
	const closed = new Promise((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new Error("Worker survived file close")),
			10000,
		);
		worker.once("close", () => {
			clearTimeout(timer);
			resolve();
		});
	});
	await page.getByRole("button", { name: "Exit", exact: true }).click();
	await closed;
	assert.equal(await page.evaluate(() => window.writes.length), 1);
	evidence.pendingExportTerminated = true;
	// A declared validation error must cross RPC and reach the UI without writing.
	const invalid = decodeSave(new TextDecoder().decode(bytes));
	// An out-of-range integer is rejected by the typed XML import itself. Missing
	// a required game location remains representable and exercises export validation.
	invalid.locations = invalid.locations.filter(
		(location) => location?.name !== "Farm",
	);
	await load(Buffer.from(encodeSave(invalid)));
	await page.getByRole("button", { name: "Export save", exact: true }).click();
	await page.getByText(/Save file not downloaded:/).waitFor();
	assert.equal(await page.evaluate(() => window.writes.length), 1);
	evidence.invalidOutputBlocked = true;
	// A native error event must fail an in-flight request and allow the pool to
	// replace its endpoint. Keep this separate from a typed validation rejection.
	await page.getByRole("button", { name: "Exit", exact: true }).click();
	await load(bytes);
	await page.getByRole("button", { name: "Export save", exact: true }).click();
	await page.waitForFunction(() => window.writes.length === 2);
	await page.evaluate(() => window.writes.pop());
	const crashing = page
		.workers()
		.find((w) => w.url().includes("save-processing"));
	await crashing.evaluate(() => {
		const original = self.postMessage.bind(self);
		self.postMessage = (message, options) => {
			if (options?.transfer?.some((x) => x instanceof ArrayBuffer)) {
				setTimeout(() => {
					throw new Error("Intentional worker transport probe");
				}, 0);
				return;
			}
			original(message, options);
		};
	});
	await page.getByRole("button", { name: "Export save", exact: true }).click();
	await page
		.getByText(/export worker is unavailable/)
		.waitFor({ timeout: 15000 });
	await page.getByRole("button", { name: "Export save", exact: true }).click();
	await page.waitForFunction(
		() => window.writes.length === 2,
		{},
		{ timeout: 20000 },
	);
	evidence.workerRetry = true;
	await page.getByRole("button", { name: "Exit", exact: true }).click();
	evidence.errors = errors;
	assert(errors.every((e) => e.includes("Intentional worker transport probe")));
	console.log(JSON.stringify(evidence));
} catch (error) {
	// CI artifacts should explain the visible state when a regression prevents
	// the expected transition; record metadata only, never uploaded save contents.
	if (page && output) {
		await page.screenshot({ path: `${output}.failure.png` }).catch(() => {});
		evidence.failure = {
			message: String(error),
			alerts: await page.locator('[role="alert"]').allTextContents(),
			statuses: await page.locator('[role="status"]').allTextContents(),
			startup: await page.evaluate(() => window.startupAttempts),
		};
	}
	throw error;
} finally {
	await browser.close();
	if (output) writeFileSync(output, JSON.stringify(evidence, null, 2));
}
