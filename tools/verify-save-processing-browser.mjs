import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { deflateSync } from "node:zlib";

import { Schema } from "effect";
import { chromium } from "playwright";

import { XmlSchema } from "../generated/save-format/save.ts";
// Drive import and export against production preview with real browser workers. Keep this
// separate from happy-dom tests: worker transfer and termination need a browser.
/** @template {string | undefined} T @param {string} name @param {T} fallback @returns {string | T} */
const argument = (name, fallback) => {
	const index = process.argv.indexOf(name);
	return index < 0 ? fallback : (process.argv[index + 1] ?? fallback);
};
const url = argument("--url", "http://127.0.0.1:4269/stardew-save-editor/");
const output = argument("--output", undefined);
// CI installs Playwright Chromium. Developers can select an installed browser
// with --channel chrome or --chromium /path/to/chromium without changing the flow.
const channel = argument("--channel", undefined);
const executablePath = argument("--chromium", undefined);
const browser = await chromium.launch({
	// An omitted selection lets Playwright use its installed default browser.
	...(channel === undefined ? {} : { channel }),
	...(executablePath === undefined ? {} : { executablePath }),
	headless: true,
});
const decodeSave = Schema.decodeUnknownSync(XmlSchema);
const encodeSave = Schema.encodeSync(XmlSchema);
const bytes = readFileSync(new URL("../tests/TestSave", import.meta.url));
/** @type {Record<string, unknown>} */
const evidence = {};
/** @type {import("playwright").Page | undefined} */
let page;
try {
	const currentPage = await browser.newPage();
	page = currentPage;
	currentPage.setDefaultTimeout(30_000);
	/** @type {string[]} */
	const errors = [];
	currentPage.on("pageerror", (e) => errors.push(e.message));
	await currentPage.route(/sentry\.io/, (route) => route.abort());
	// Accept a destination without writing to disk. Every recorded write therefore
	// proves the application got through worker export and validation successfully.
	await currentPage.addInitScript(() => {
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
			/** @param {string | URL} script @param {WorkerOptions} [options] */
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
			/** @override */
			terminate() {
				if (this.lifetime) this.lifetime.terminated = true;
				return super.terminate();
			}
			/** @override @param {unknown} message @param {StructuredSerializeOptions | Transferable[]} [options] */
			postMessage(message, options) {
				/** @type {unknown} */
				const request =
					Array.isArray(message) && message[0] === 0 ? message[1] : undefined;
				const tag =
					request !== null && typeof request === "object" && "tag" in request
						? request.tag
						: undefined;
				if (tag === "importBlob" && window.holdImport) {
					window.heldImports.push({
						worker: this,
						message,
						...(options === undefined ? {} : { options }),
					});
					return;
				}
				if (tag === "exportSave" && window.holdExport) {
					window.releaseExport = () =>
						super.postMessage(
							message,
							Array.isArray(options) ? { transfer: options } : options,
						);
					return;
				}
				const buffers = (
					Array.isArray(options)
						? options
						: ((typeof options === "object" ? options?.transfer : undefined) ??
							[])
				).filter((value) => value instanceof ArrayBuffer);
				const before = buffers.map((value) => value.byteLength);
				super.postMessage(
					message,
					Array.isArray(options) ? { transfer: options } : options,
				);
				if (
					tag === "importBlob" &&
					request !== null &&
					typeof request === "object" &&
					"payload" in request &&
					request.payload !== null &&
					typeof request.payload === "object" &&
					"blob" in request.payload &&
					request.payload.blob instanceof Blob
				)
					window.importSources.push({
						before,
						after: buffers.map((value) => value.byteLength),
						blobSize: request.payload.blob.size,
						mainReads: window.fileReads.get(request.payload.blob) ?? 0,
					});
			}
		};
		// This destination intentionally implements only the operations the editor uses.
		Object.defineProperty(window, "showSaveFilePicker", {
			configurable: true,
			value: async () => {
				if (window.holdPicker)
					await new Promise((resolve) => {
						window.releasePicker = () => resolve(undefined);
					});
				return {
					createWritable: () =>
						Promise.resolve({
							/** @param {Blob} b */
							write: async (b) => {
								if (window.holdWrite) {
									window.writeStarted = true;
									await new Promise((resolve) => {
										window.releaseWrite = () => resolve(undefined);
									});
								}
								window.writes.push(await b.text());
							},
							close: () => Promise.resolve(),
							abort: () => Promise.resolve(),
						}),
				};
			},
		});
	});
	await currentPage.goto(url);
	/** @param {Buffer} buffer */
	const choose = async (buffer) => {
		await currentPage.getByLabel("Save file", { exact: true }).setInputFiles({
			name: "ProbeFarm",
			mimeType: "application/octet-stream",
			buffer,
		});
	};
	/** @param {Buffer} buffer */
	const load = async (buffer) => {
		await choose(buffer);
		await currentPage
			.getByRole("button", { name: "Export save", exact: true })
			.waitFor({ timeout: 120000 });
	};
	/** @param {string} name */
	const checkCompactPhase = async (name) => {
		const originalViewport = currentPage.viewportSize();
		await currentPage.setViewportSize({ width: 390, height: 900 });
		assert(await currentPage.getByText(name, { exact: true }).isVisible());
		assert(
			await currentPage.evaluate(
				() => document.documentElement.scrollWidth <= innerWidth,
			),
			"Loading feedback must not create horizontal overflow",
		);
		if (output !== undefined && output.length > 0)
			await currentPage.screenshot({
				path: `${output}.${name.startsWith("Opening") ? "import" : "export"}-mobile.png`,
			});
		if (originalViewport) await currentPage.setViewportSize(originalViewport);
	};
	// Startup failures must release their partially acquired scopes, restore the
	// upload screen, and allow a new worker/session on the very next attempt.
	/** @type {Array<{ failure: string; retry: boolean; workersReleased: boolean }>} */
	const startupFailures = [];
	evidence["startupFailures"] = startupFailures;
	await currentPage.evaluate(() => {
		window.holdImport = false;
	});
	for (const failure of ["constructor", "module"]) {
		await currentPage.evaluate((failureMode) => {
			window.failWorkerStartup = failureMode;
		}, failure);
		await choose(bytes);
		await currentPage
			.getByText(/The save could not be (opened|processed)/)
			.waitFor({ timeout: 10000 });
		assert(
			await currentPage.getByLabel("Save file", { exact: true }).isEnabled(),
		);
		assert.equal(
			await currentPage
				.getByRole("button", { name: "Export save", exact: true })
				.count(),
			0,
		);
		assert(
			await currentPage.evaluate(() =>
				window.workerLifetimes.every((worker) => worker.terminated),
			),
		);
		await load(bytes);
		await currentPage
			.getByRole("button", { name: "Exit", exact: true })
			.click();
		await currentPage.getByLabel("Save file", { exact: true }).waitFor();
		assert(
			await currentPage.evaluate(() =>
				window.workerLifetimes.every((worker) => worker.terminated),
			),
		);
		startupFailures.push({
			failure,
			retry: true,
			workersReleased: true,
		});
	}
	await currentPage.evaluate(() => {
		window.holdImport = true;
	});
	// Cancel before a session is installed. The loading UI must remain responsive,
	// disable duplicate input, and terminate the pending import's dedicated worker.
	await choose(bytes);
	await currentPage.waitForFunction(() => window.heldImports.length > 0);
	assert(
		await currentPage.getByLabel("Save file", { exact: true }).isDisabled(),
	);
	await currentPage.getByText("Opening save…", { exact: true }).waitFor();
	if (output !== undefined && output.length > 0)
		await currentPage.screenshot({ path: `${output}.loading.png` });
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
			resolve(undefined);
		});
	});
	await currentPage
		.getByRole("button", { name: "Cancel import", exact: true })
		.click();
	await importClosed;
	assert(
		await currentPage.getByLabel("Save file", { exact: true }).isEnabled(),
	);
	assert.equal(
		await currentPage
			.getByRole("button", { name: "Export save", exact: true })
			.count(),
		0,
	);
	await currentPage.evaluate(() => {
		window.holdImport = false;
		window.heldImports = [];
	});
	evidence["importCancellation"] = true;
	await choose(Buffer.from("broken XML"));
	await currentPage
		.getByText(/This file could not be read as a Stardew Valley save/)
		.waitFor();
	assert(
		await currentPage.getByLabel("Save file", { exact: true }).isEnabled(),
	);
	evidence["importFailureRecovered"] = true;
	// Exercise decompression as well as XML decode, then reuse this file's worker
	// for export. Import must clone the original Blob without eagerly reading it.
	await load(deflateSync(bytes));
	const importedWorker = page
		.workers()
		.find((worker) => worker.url().includes("save-processing"));
	const importSources = await currentPage.evaluate(() => window.importSources);
	evidence["importSources"] = importSources;
	assert(
		importSources.some(
			(item) =>
				item.before.length === 0 &&
				item.after.length === 0 &&
				item.blobSize > 0 &&
				item.mainReads === 0,
		),
	);
	await currentPage.evaluate(() => {
		window.holdPicker = true;
	});
	await currentPage
		.getByRole("button", { name: "Export save", exact: true })
		.click();
	await currentPage
		.getByText("Choose where to save…", { exact: true })
		.waitFor();
	await currentPage.evaluate(() => {
		window.holdPicker = false;
		window.releasePicker();
	});
	await currentPage.waitForFunction(() => window.writes.length === 1);
	await currentPage.evaluate(() => (window.writes = []));
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
			const buffers = (
				(typeof options === "object" ? options?.transfer : undefined) ?? []
			).filter((x) => x instanceof ArrayBuffer);
			/** @type {import("./browser-probes.d.ts").TransferCheck} */
			const check = { before: buffers.map((x) => x.byteLength) };
			Reflect.apply(original, self, [message, options]);
			if (buffers.length > 0) {
				check.after = buffers.map((x) => x.byteLength);
				self.transferChecks.push(check);
			}
		};
	});
	await currentPage.evaluate(() => {
		window.holdExport = true;
		window.holdWrite = true;
	});
	await currentPage
		.getByRole("button", { name: "Export save", exact: true })
		.click();
	await currentPage.waitForFunction(() => Boolean(window.releaseExport));
	await currentPage.getByText("Preparing save…", { exact: true }).waitFor();
	if (output !== undefined && output.length > 0)
		await currentPage.screenshot({ path: `${output}.preparing.png` });
	await checkCompactPhase("Preparing save…");
	assert(
		await currentPage
			.getByRole("button", { name: "Export save", exact: true })
			.isDisabled(),
	);
	await currentPage.evaluate(() => {
		window.holdExport = false;
		if (!window.releaseExport) throw new Error("Missing held export");
		window.releaseExport();
	});
	await currentPage.waitForFunction(() => window.writeStarted);
	await currentPage.getByText("Writing save…", { exact: true }).waitFor();
	await currentPage.evaluate(() => {
		window.holdWrite = false;
		window.releaseWrite();
	});
	await currentPage.waitForFunction(() => window.writes.length === 1);
	evidence["loadingPhases"] = true;
	// Compare every decoded value, including bigint IDs and unknown fields. XML
	// declarations, formatting and namespace placement are intentionally canonical.
	// Keep assertion failures compact instead of dumping the complete save into CI.
	assert.ok(
		isDeepStrictEqual(
			decodeSave(await currentPage.evaluate(() => window.writes[0])),
			decodeSave(new TextDecoder().decode(bytes)),
		),
		"Worker export changed the decoded save",
	);
	const transfer = await worker.evaluate(() => self.transferChecks);
	evidence["transfer"] = transfer;
	assert(transfer.some((x) => (x.before[0] ?? 0) > 0 && x.after?.[0] === 0));
	evidence["exactPreservation"] = true;
	// A blocked response is real pending worker work. Exit must terminate it and
	// suppress all writes, instead of retaining a worker until its CPU task ends.
	await worker.evaluate(() => {
		const original = self.postMessage.bind(self);
		self.heldResponses = 0;
		self.responseHeld = new Promise((resolve) => {
			self.resolveHeldResponse = resolve;
		});
		self.postMessage = (message, options) => {
			if (
				(typeof options === "object" ? options?.transfer : undefined)?.some(
					(x) => x instanceof ArrayBuffer,
				) === true
			) {
				self.heldResponses++;
				self.resolveHeldResponse();
				return;
			}
			Reflect.apply(original, self, [message, options]);
		};
	});
	await currentPage
		.getByRole("button", { name: "Export save", exact: true })
		.click();
	await currentPage.waitForFunction(() => {
		const button = document.querySelector('button[aria-label="Export save"]');
		return button instanceof HTMLButtonElement && button.disabled;
	});
	// Wait for the response we deliberately intercepted, rather than assuming a
	// full typed XML export finishes within a fixed five-second polling window.
	await worker.evaluate(
		() =>
			new Promise((resolve, reject) => {
				const timer = setTimeout(
					() => reject(new Error("Export did not reach the held response")),
					30_000,
				);
				void self.responseHeld.then(() => {
					clearTimeout(timer);
					resolve(undefined);
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
			resolve(undefined);
		});
	});
	await currentPage.getByRole("button", { name: "Exit", exact: true }).click();
	await closed;
	assert.equal(await currentPage.evaluate(() => window.writes.length), 1);
	evidence["pendingExportTerminated"] = true;
	// A declared validation error must cross RPC and reach the UI without writing.
	const invalid = decodeSave(new TextDecoder().decode(bytes));
	// An out-of-range integer is rejected by the typed XML import itself. Missing
	// a required game location remains representable and exercises export validation.
	invalid.locations = (invalid.locations ?? []).filter(
		(location) => location?.name !== "Farm",
	);
	await load(Buffer.from(encodeSave(invalid)));
	await currentPage
		.getByRole("button", { name: "Export save", exact: true })
		.click();
	await currentPage.getByText(/Save file not downloaded:/).waitFor();
	assert.equal(await currentPage.evaluate(() => window.writes.length), 1);
	evidence["invalidOutputBlocked"] = true;
	// A native error event must fail an in-flight request and allow the pool to
	// replace its endpoint. Keep this separate from a typed validation rejection.
	await currentPage.getByRole("button", { name: "Exit", exact: true }).click();
	await load(bytes);
	await currentPage
		.getByRole("button", { name: "Export save", exact: true })
		.click();
	await currentPage.waitForFunction(() => window.writes.length === 2);
	await currentPage.evaluate(() => window.writes.pop());
	const crashing = page
		.workers()
		.find((w) => w.url().includes("save-processing"));
	assert(crashing, "Missing worker for intentional crash");
	await crashing.evaluate(() => {
		const original = self.postMessage.bind(self);
		self.postMessage = (message, options) => {
			if (
				(typeof options === "object" ? options?.transfer : undefined)?.some(
					(x) => x instanceof ArrayBuffer,
				) === true
			) {
				setTimeout(() => {
					throw new Error("Intentional worker transport probe");
				}, 0);
				return;
			}
			Reflect.apply(original, self, [message, options]);
		};
	});
	await currentPage
		.getByRole("button", { name: "Export save", exact: true })
		.click();
	await currentPage
		.getByText(/export worker is unavailable/)
		.waitFor({ timeout: 15000 });
	await currentPage
		.getByRole("button", { name: "Export save", exact: true })
		.click();
	await currentPage.waitForFunction(
		() => window.writes.length === 2,
		{},
		{ timeout: 20000 },
	);
	evidence["workerRetry"] = true;
	await currentPage.getByRole("button", { name: "Exit", exact: true }).click();
	evidence["errors"] = errors;
	assert(errors.every((e) => e.includes("Intentional worker transport probe")));
	console.log(JSON.stringify(evidence));
} catch (error) {
	// CI artifacts should explain the visible state when a regression prevents
	// the expected transition; record metadata only, never uploaded save contents.
	if (page && output !== undefined && output.length > 0) {
		await page.screenshot({ path: `${output}.failure.png` }).catch(() => {});
		evidence["failure"] = {
			message: String(error),
			alerts: await page.locator('[role="alert"]').allTextContents(),
			statuses: await page.locator('[role="status"]').allTextContents(),
			startup: await page.evaluate(() => window.startupAttempts),
		};
	}
	throw error;
} finally {
	await browser.close();
	if (output !== undefined && output.length > 0)
		writeFileSync(output, JSON.stringify(evidence, null, 2));
}
