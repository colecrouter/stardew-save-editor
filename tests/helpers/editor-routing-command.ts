import { spawn } from "node:child_process";
import { once } from "node:events";

import { defineBrowserCommand } from "@vitest/browser-playwright";
import type { BrowserContext } from "playwright";

import { testTimeouts } from "./timeouts.ts";

declare module "vitest/browser" {
	interface BrowserCommands {
		checkEditorRouting(saveXml: string): ReturnType<typeof verifyRouting>;
	}
}

// The Browser Mode harness does not serve Kit's page routes. Start a real
// development server on an ephemeral port in an isolated Kit process.
const devServerScript = `
	import { createServer } from "vite-plus";
	process.on("disconnect", () => process.exit());
	const server = await createServer({
		mode: "development",
		server: { host: "127.0.0.1", port: 0 },
	});
	await server.listen();
	process.send("http://127.0.0.1:" + server.httpServer.address().port);
`;

export const checkEditorRouting = defineBrowserCommand(
	async ({ context }, saveXml: string) => {
		const server = spawn(
			process.execPath,
			["--input-type=module", "--eval", devServerScript],
			{
				env: { ...process.env, NODE_ENV: "development", VITEST: "true" },
				stdio: ["ignore", "ignore", "inherit", "ipc"],
			},
		);
		const stopped = once(server, "exit");
		try {
			const message: unknown[] = await Promise.race([
				once(server, "message", {
					signal: AbortSignal.timeout(testTimeouts.assertion),
				}),
				stopped.then(() => {
					throw new Error("Kit exited before serving the editor.");
				}),
			]);
			const origin = message[0];
			if (typeof origin !== "string")
				throw new Error("Kit did not report its local URL.");
			return await verifyRouting(context, origin, saveXml);
		} finally {
			server.kill();
			await stopped;
		}
	},
);

async function verifyRouting(
	context: BrowserContext,
	origin: string,
	saveXml: string,
) {
	// Keep real document and history navigation outside the runner iframe.
	const page = await context.newPage();
	const errors: string[] = [];
	try {
		page.setDefaultTimeout(testTimeouts.assertion);
		await page.setViewportSize({ width: 390, height: 900 });
		await page.route(/sentry\.io/, (route) => route.abort());
		page.on("pageerror", (error) => errors.push(error.message));
		// One listener answers every dialog for the page's whole life. Per-step
		// `once` listeners raced Playwright: a click can return before its dialog
		// arrives, and toggling listeners around it let the same dialog be answered
		// twice. The rejected answer was never awaited, so it aborted the whole
		// test run. Each step now queues the answer it expects and waits until that
		// dialog has actually been answered. Unexpected dialogs and failed answers
		// are recorded as errors, which the test asserts are empty.
		const expectedDialogs: {
			accept: boolean;
			answered: PromiseWithResolvers<string>;
		}[] = [];
		page.on("dialog", (dialog) => {
			const expected = expectedDialogs.shift();
			if (expected === undefined) {
				errors.push(`Unexpected ${dialog.type()} dialog: ${dialog.message()}`);
				// Dismissing keeps a regression from following a link unasked.
				dialog.dismiss().catch((error: unknown) => {
					errors.push(
						`Dismissing an unexpected dialog failed: ${String(error)}`,
					);
				});
				return;
			}
			(expected.accept ? dialog.accept() : dialog.dismiss()).then(
				() => expected.answered.resolve(dialog.message()),
				(error: unknown) => expected.answered.reject(error),
			);
		});
		// Runs `action`, which must open exactly one dialog, answers it as asked
		// and returns its message once the browser has received the answer.
		const answerDialog = async (
			accept: boolean,
			action: () => Promise<void>,
		): Promise<string> => {
			const answered = Promise.withResolvers<string>();
			// Mark the rejection as handled right away: an answer can fail before
			// `action()` returns, and the await below still reports it.
			answered.promise.catch(() => {});
			expectedDialogs.push({ accept, answered });
			try {
				await action();
				// Fail the step if the dialog never opens. The timer is cleared once
				// the answer arrives, so a passing step leaves no rejection behind.
				const timer = setTimeout(() => {
					answered.reject(new Error("The expected dialog never opened."));
				}, testTimeouts.assertion);
				try {
					return await answered.promise;
				} finally {
					clearTimeout(timer);
				}
			} finally {
				// Drop this step's answer if no dialog claimed it, so a later dialog
				// can't be answered with it.
				const index = expectedDialogs.findIndex(
					(entry) => entry.answered === answered,
				);
				if (index !== -1) expectedDialogs.splice(index, 1);
			}
		};
		await page.goto(new URL("/editor/calendar", origin).href);
		// The caller supplies XML so Vite's Node configuration never imports
		// the app's fixture dependency graph. The page still uses its real worker.
		await page.getByLabel("Save file", { exact: true }).setInputFiles({
			name: "RouteTest_1",
			mimeType: "application/octet-stream",
			buffer: Buffer.from(saveXml),
		});

		const menu = page.locator(".section-menu");
		const summary = menu.locator("summary");
		const year = page.getByRole("spinbutton", { name: "Year", exact: true });
		const originalYear = await year.inputValue();
		const editedYear = String(Number(originalYear) + 1);
		await year.fill(editedYear);
		await summary.click();
		const farmLink = menu.getByRole("link", {
			name: "Farm settings",
			exact: true,
		});

		// Canceling must leave both the unapplied value and the open disclosure.
		const warning = await answerDialog(false, () => farmLink.click());
		const canceled = {
			path: new URL(page.url()).pathname,
			year: await year.inputValue(),
			menuOpen: (await menu.getAttribute("open")) !== null,
		};

		// Kit intercepts full-page links before the browser's unload hook.
		// They still need an explicit warning, just like client-side links.
		await farmLink.evaluate((link) =>
			link.setAttribute("data-sveltekit-reload", "true"),
		);
		const reloadWarning = await answerDialog(false, () => farmLink.click());
		await farmLink.evaluate((link) =>
			link.removeAttribute("data-sveltekit-reload"),
		);

		// Accepting discards the draft and follows the real link.
		await answerDialog(true, () => farmLink.click());
		await page.waitForURL("**/editor/farm");
		await page.locator(".section-menu:not([open])").waitFor();
		const farmName = page.getByRole("textbox", {
			name: "Farm name",
			exact: true,
		});
		await farmName.fill("Route history farm");
		await page.goBack();
		await page.waitForURL("**/editor/calendar");
		const restoredYear = await year.inputValue();
		await page.goForward();
		await page.waitForURL("**/editor/farm");
		// Applied edits survive a panel unmount, including a focused field that
		// never received an ordinary blur before browser Back.
		const restoredFarmName = await farmName.inputValue();
		await summary.click();
		await menu.getByRole("link", { name: "Rebuild lost progress" }).click();
		const guide = page.locator("#editor-content");
		const step = guide.getByRole("checkbox", {
			name: "Mark Date and weather done",
		});
		await step.check();
		await guide
			.getByRole("link", { name: "Date and weather", exact: true })
			.click();
		await page.waitForURL("**/editor/calendar");
		await page.goBack();
		await page.waitForURL("**/editor/reconstruct");

		return {
			warning,
			reloadWarning,
			editedYear,
			originalYear,
			canceled,
			restoredYear,
			restoredFarmName,
			guideStepRetained: await step.isChecked(),
			errors,
		};
	} finally {
		await page.close();
	}
}
