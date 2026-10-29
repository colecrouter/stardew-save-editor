import { describe, expect, it, vi } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/svelte";
import EditorApp from "../../src/lib/editor/ui/EditorApp.svelte";
import { fixtureXml, parser } from "./fixtures";

// Each scenario imports the complete save and performs real history operations.
// Keep a bounded integration budget without changing ordinary unit-test timeouts.
describe("full-save farm workflow", { timeout: 15_000 }, () => {
	const openFarm = async () => {
		const page = render(EditorApp);
		try {
			await fireEvent.change(page.getByLabelText("Save file"), {
				target: { files: [new File([fixtureXml], "Farm_123")] },
			});
			await waitFor(
				() =>
					expect(
						page.getByRole("link", { name: "Farm settings" }),
					).toBeTruthy(),
				{ timeout: 5000 },
			);
			await fireEvent.click(page.getByRole("link", { name: "Farm settings" }));
			return page;
		} catch (error) {
			page.unmount();
			throw error;
		}
	};
	type Page = Awaited<ReturnType<typeof openFarm>>;
	// The mounted Review section renders one ordered-list row per recorded action.
	// Count that user-facing history rather than introducing a second model harness.
	const actionCount = (page: Page) =>
		page.container.querySelector("ol")?.children.length ?? 0;
	const idle = async (page: Page) =>
		waitFor(() => {
			expect(
				page
					.getByRole("button", { name: "Export save" })
					.hasAttribute("disabled"),
			).toBe(false);
			// Toolbar actions remain available to queue behind a blur commit.
			// Wait on the controls' own saving flags, never a global click lock.
			for (const control of [
				page.getByRole("textbox", { name: "Farm name" }),
				page.getByRole("spinbutton", { name: "Profit margin (%)" }),
				page.getByRole("checkbox", { name: "Spawn monsters on the farm" }),
				page.getByRole("combobox", { name: "Mine rewards" }),
			])
				expect(control.hasAttribute("disabled")).toBe(false);
		});

	it("farm name applies while typing but preserves one Undo step for the whole focus gesture", async () => {
		const page = await openFarm();
		try {
			const name = page.getByRole("textbox", {
				name: "Farm name",
			}) as HTMLInputElement;
			const initial = name.value;
			expect(
				page.queryByRole("button", { name: "Apply farm settings" }),
			).toBeNull();
			expect(
				page.queryByRole("button", { name: "Reload farm settings" }),
			).toBeNull();
			name.focus();
			await fireEvent.input(name, { target: { value: "R" } });
			await fireEvent.input(name, { target: { value: "River" } });
			await fireEvent.input(name, { target: { value: "River Farm" } });
			await waitFor(() => expect(actionCount(page)).toBe(1));
			await fireEvent.blur(name);
			await fireEvent.click(page.getByRole("button", { name: "Undo" }));
			// The first history row can appear while later full-save edits are still
			// queued. Undo must run behind all of them; allow that bounded CI work
			// without waiting for idle first and losing the ordering regression.
			await waitFor(() => expect(name.value).toBe(initial), { timeout: 5000 });
			await fireEvent.click(page.getByRole("button", { name: "Redo" }));
			await waitFor(() => expect(name.value).toBe("River Farm"), {
				timeout: 5000,
			});
			name.focus();
			await fireEvent.input(name, { target: { value: "" } });
			expect(name.value).toBe("");
			await fireEvent.blur(name);
			await waitFor(() => expect(name.value).toBe("River Farm"));
			expect(actionCount(page)).toBe(1);
			name.focus();
			await fireEvent.input(name, { target: { value: "   " } });
			await waitFor(() =>
				expect(name.getAttribute("aria-invalid")).toBe("true"),
			);
			await fireEvent.blur(name);
			await waitFor(() => expect(name.value).toBe("River Farm"));
			expect(page.getByText(/Enter a farm name/)).toBeTruthy();
			expect(
				page.getByRole("heading", { name: "Farm creation settings" }),
			).toBeTruthy();
			expect(page.queryByRole("textbox", { name: "Random seed" })).toBeNull();
		} finally {
			page.unmount();
		}
	});

	it("profit edits apply immediately, group typing, and reject invalid values without new history", async () => {
		const page = await openFarm();
		try {
			const profit = page.getByRole("spinbutton", {
				name: "Profit margin (%)",
			}) as HTMLInputElement;
			profit.focus();
			await fireEvent.input(profit, { target: { value: "7" } });
			await fireEvent.input(profit, { target: { value: "75" } });
			await waitFor(() => expect(actionCount(page)).toBe(1));
			await fireEvent.blur(profit);
			profit.focus();
			await fireEvent.input(profit, { target: { value: "0" } });
			await waitFor(() =>
				expect(profit.getAttribute("aria-invalid")).toBe("true"),
			);
			await fireEvent.blur(profit);
			await waitFor(() => expect(profit.value).toBe("75"));
			expect(actionCount(page)).toBe(1);
			expect(page.getByText(/profit percentage from 1 to 1000/)).toBeTruthy();
			profit.focus();
			await fireEvent.input(profit, { target: { value: "50" } });
			await waitFor(() => expect(actionCount(page)).toBe(2));
			await fireEvent.click(page.getByRole("button", { name: "Undo" }));
			await waitFor(() => expect(profit.value).toBe("75"));
			await fireEvent.click(page.getByRole("button", { name: "Redo" }));
			await waitFor(() => expect(profit.value).toBe("50"));
			await fireEvent.input(profit, { target: { value: "" } });
			expect(profit.value).toBe("");
			await fireEvent.blur(profit);
			await waitFor(() => expect(profit.value).toBe("50"));
			expect(actionCount(page)).toBe(2);
		} finally {
			page.unmount();
		}
	});

	it("monster and mine selectors commit immediately, undo independently, and leave calendar draft gating intact", async () => {
		const page = await openFarm();
		try {
			const monsters = page.getByRole("checkbox", {
				name: "Spawn monsters on the farm",
			}) as HTMLInputElement;
			const rewards = page.getByRole("combobox", {
				name: "Mine rewards",
			}) as HTMLSelectElement;
			const initialMonsters = monsters.checked;
			const initialRewards = rewards.value;
			const changedRewards =
				initialRewards === "Remixed" ? "Default" : "Remixed";
			await fireEvent.click(monsters);
			await waitFor(() => expect(actionCount(page)).toBe(1));
			await idle(page);
			expect(monsters.checked).toBe(!initialMonsters);
			await fireEvent.change(rewards, { target: { value: changedRewards } });
			await waitFor(() => expect(actionCount(page)).toBe(2));
			await idle(page);
			expect(rewards.value).toBe(changedRewards);
			// Each immediate control is one independent action rather than a shared form.
			await fireEvent.click(page.getByRole("button", { name: "Undo" }));
			await waitFor(() => expect(rewards.value).toBe(initialRewards));
			await idle(page);
			expect(monsters.checked).toBe(!initialMonsters);
			await fireEvent.click(page.getByRole("button", { name: "Undo" }));
			await waitFor(() => expect(monsters.checked).toBe(initialMonsters));
			await idle(page);
			await fireEvent.click(page.getByRole("button", { name: "Redo" }));
			await waitFor(() => expect(monsters.checked).toBe(!initialMonsters));
			await idle(page);
			await fireEvent.click(page.getByRole("button", { name: "Redo" }));
			await waitFor(() => expect(rewards.value).toBe(changedRewards));
			await idle(page);
			expect(actionCount(page)).toBe(2);
			await fireEvent.click(
				page.getByRole("link", { name: "Date and weather" }),
			);
			await fireEvent.input(page.getByRole("spinbutton", { name: "Year" }), {
				target: { value: "3" },
			});
			expect(
				page
					.getByRole("button", { name: "Export save" })
					.hasAttribute("disabled"),
			).toBe(true);
			await fireEvent.click(page.getByRole("link", { name: "Farm settings" }));
			expect(
				page
					.getByRole("button", { name: "Export save" })
					.hasAttribute("disabled"),
			).toBe(true);
		} finally {
			page.unmount();
		}
	});
	it("blurring a name then clicking another control preserves both queued edits", async () => {
		const page = await openFarm();
		try {
			const name = page.getByRole("textbox", {
				name: "Farm name",
			}) as HTMLInputElement;
			const monsters = page.getByRole("checkbox", {
				name: "Spawn monsters on the farm",
			}) as HTMLInputElement;
			const initialMonsters = monsters.checked;
			name.focus();
			await fireEvent.input(name, { target: { value: "Concurrent Farm" } });
			// Dispatch both browser events before yielding to the command queue.
			// A global pending lock would swallow the checkbox after name blur.
			await Promise.all([fireEvent.blur(name), fireEvent.click(monsters)]);
			await waitFor(() => expect(actionCount(page)).toBe(2));
			await idle(page);
			expect(name.value).toBe("Concurrent Farm");
			expect(monsters.checked).toBe(!initialMonsters);
		} finally {
			page.unmount();
		}
	});

	it("export includes the latest typed name before blur and finalizes its Undo group", async () => {
		let written: Blob | undefined;
		const picker = vi.fn(async () => ({
			createWritable: async () => ({
				write: async (blob: Blob) => {
					written = blob;
				},
				close: async () => {},
			}),
		}));
		Object.defineProperty(window, "showSaveFilePicker", {
			configurable: true,
			value: picker,
		});
		const page = await openFarm();
		try {
			const name = page.getByRole("textbox", {
				name: "Farm name",
			}) as HTMLInputElement;
			name.focus();
			await fireEvent.input(name, { target: { value: "Export Farm" } });
			await fireEvent.click(page.getByRole("button", { name: "Export save" }));
			await waitFor(() => expect(written).toBeTruthy(), { timeout: 5000 });
			if (!written)
				throw Error("Expected the browser file writer to receive a save");
			expect(parser.parse(await written.text()).SaveGame.player.farmName).toBe(
				"Export Farm",
			);
			expect(picker).toHaveBeenCalledOnce();
			expect(actionCount(page)).toBe(1);
		} finally {
			page.unmount();
			Reflect.deleteProperty(window, "showSaveFilePicker");
		}
	});
	it("Undo clicked after name blur reverses the just-committed name, and one Redo restores it", async () => {
		const page = await openFarm();
		try {
			const name = page.getByRole("textbox", {
				name: "Farm name",
			}) as HTMLInputElement;
			name.focus();
			await fireEvent.input(name, { target: { value: "Previous Farm" } });
			await fireEvent.blur(name);
			await waitFor(() => expect(actionCount(page)).toBe(1));
			await idle(page);
			name.focus();
			await fireEvent.input(name, { target: { value: "Latest Farm" } });
			// Native blur precedes the toolbar click. Both requests must enter the
			// same queue, rather than disabling Undo and swallowing the click.
			await Promise.all([
				fireEvent.blur(name),
				fireEvent.click(page.getByRole("button", { name: "Undo" })),
			]);
			await waitFor(() => expect(actionCount(page)).toBe(2));
			await waitFor(() => expect(name.value).toBe("Previous Farm"));
			await idle(page);
			expect(
				page.getByRole("button", { name: "Redo" }).hasAttribute("disabled"),
			).toBe(false);
			await fireEvent.click(page.getByRole("button", { name: "Redo" }));
			await waitFor(() => expect(name.value).toBe("Latest Farm"));
			await idle(page);
			expect(actionCount(page)).toBe(2);
		} finally {
			page.unmount();
		}
	});
});
