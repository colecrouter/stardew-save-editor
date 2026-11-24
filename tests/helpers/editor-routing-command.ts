import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

import { defineBrowserCommand } from "@vitest/browser-playwright";
import type { BrowserContext } from "playwright";

import { testTimeouts } from "./timeouts.ts";

declare module "vitest/browser" {
	interface BrowserCommands {
		checkEditorRouting(): ReturnType<typeof verifyRouting>;
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

export const checkEditorRouting = defineBrowserCommand(async ({ context }) => {
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
		return await verifyRouting(context, origin);
	} finally {
		server.kill();
		await stopped;
	}
});

async function verifyRouting(context: BrowserContext, origin: string) {
	// Keep real document and history navigation outside the runner iframe.
	const page = await context.newPage();
	const errors: string[] = [];
	try {
		page.setDefaultTimeout(testTimeouts.assertion);
		await page.setViewportSize({ width: 390, height: 900 });
		await page.route(/sentry\.io/, (route) => route.abort());
		page.on("pageerror", (error) => errors.push(error.message));
		await page.goto(new URL("/editor/calendar", origin).href);
		await page
			.getByLabel("Save file", { exact: true })
			.setInputFiles(fileURLToPath(new URL("../TestSave", import.meta.url)));

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
		let warning = "";
		page.once("dialog", (dialog) => {
			warning = dialog.message();
			return dialog.dismiss();
		});
		await farmLink.click();
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
		let reloadWarning = "";
		page.once("dialog", (dialog) => {
			reloadWarning = dialog.message();
			return dialog.dismiss();
		});
		await farmLink.click();
		// Remove any unused listener so a regression cannot dismiss the next step.
		page.removeAllListeners("dialog");
		await farmLink.evaluate((link) =>
			link.removeAttribute("data-sveltekit-reload"),
		);

		// Accepting discards the draft and follows the real link.
		page.once("dialog", (dialog) => dialog.accept());
		await farmLink.click();
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
