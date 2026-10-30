import { fireEvent, render, waitFor, within } from "@testing-library/svelte";
import { tick } from "svelte";
import { expect, it, vi } from "vitest";
import { Result } from "effect";
import { openEditor } from "../../src/lib/editor/editor-model";
import { MutationError } from "../../src/lib/editor/domain";
import BackpackHarness from "./BackpackHarness.svelte";
import { fixtureXml } from "./fixtures";

async function startAdd(container: HTMLElement) {
	const page = within(container);
	await fireEvent.click(page.getByRole("button", { name: "Slot 4: Empty" }));
	await fireEvent.input(page.getByRole("searchbox", { name: "Search items" }), {
		target: { value: "(O)388" },
	});
	await fireEvent.click(
		page.getByRole("button", { name: "Preview Wood ((O)388)" }),
	);
	const add = page.getByRole("button", { name: "Add to slot 4" });
	add.focus();
	await fireEvent.click(add);
}

it.each(["success", "failure"] as const)(
	"a late add %s cannot replace a newer choice or its focus/error",
	async (outcome) => {
		const opened = await openEditor(new TextEncoder().encode(fixtureXml));
		const ready = Promise.withResolvers<void>();
		const release = Promise.withResolvers<void>();
		const original = opened.model.commands.changeInventorySlot;
		const command = vi
			.spyOn(opened.model.commands, "changeInventorySlot")
			.mockImplementation(async (request) => {
				const result =
					outcome === "success"
						? await original(request)
						: Result.fail(new MutationError("Old selection failed"));
				ready.resolve();
				await release.promise;
				return result;
			});
		const page = render(BackpackHarness, { model: opened.model });
		try {
			await startAdd(page.container);
			await ready.promise;
			// The command targets its captured empty slot, but a later user choice
			// owns inspector selection and focus before that receipt is delivered.
			const later = page.getByRole("button", { name: "Slot 2: Pickaxe" });
			later.focus();
			await fireEvent.click(later);
			release.resolve();
			await command.mock.results[0]?.value;
			await tick();
			await tick();
			expect(later.getAttribute("aria-pressed")).toBe("true");
			expect(document.activeElement).toBe(later);
			expect(page.queryByText("Old selection failed")).toBeNull();
			if (outcome === "success")
				expect(page.getByRole("button", { name: "Slot 4: Wood" })).toBeTruthy();
		} finally {
			release.resolve();
			command.mockRestore();
			page.unmount();
			await opened.close();
		}
	},
);

it.each(["hidden", "unmounted"] as const)(
	"a pending add does not restore focus into a %s panel",
	async (state) => {
		const opened = await openEditor(new TextEncoder().encode(fixtureXml));
		const ready = Promise.withResolvers<void>();
		const release = Promise.withResolvers<void>();
		const original = opened.model.commands.changeInventorySlot;
		const command = vi
			.spyOn(opened.model.commands, "changeInventorySlot")
			.mockImplementation(async (request) => {
				const result = await original(request);
				ready.resolve();
				await release.promise;
				return result;
			});
		const page = render(BackpackHarness, { model: opened.model });
		try {
			await startAdd(page.container);
			await ready.promise;
			if (state === "hidden") page.container.hidden = true;
			else page.unmount();
			const focus = vi.spyOn(HTMLElement.prototype, "focus");
			try {
				release.resolve();
				await command.mock.results[0]?.value;
				await tick();
				await tick();
				expect(focus).not.toHaveBeenCalled();
			} finally {
				focus.mockRestore();
			}
		} finally {
			release.resolve();
			command.mockRestore();
			page.unmount();
			await opened.close();
		}
	},
);

it("accepts a keyboard click after touch drag while suppressing the synthetic pointer click", async () => {
	const opened = await openEditor(new TextEncoder().encode(fixtureXml));
	const page = render(BackpackHarness, { model: opened.model });
	const source = page.getByRole("button", { name: "Slot 5: Parsnip" });
	const destination = page.getByRole("button", { name: "Slot 4: Empty" });
	const hit = vi
		.spyOn(document, "elementFromPoint")
		.mockReturnValue(destination);
	try {
		await fireEvent.pointerDown(source, {
			pointerId: 9,
			pointerType: "touch",
			clientX: 10,
			clientY: 100,
		});
		await fireEvent.pointerMove(source, {
			pointerId: 9,
			pointerType: "touch",
			clientX: 60,
			clientY: 100,
		});
		await fireEvent.pointerUp(source, {
			pointerId: 9,
			pointerType: "touch",
			clientX: 60,
			clientY: 100,
		});
		await waitFor(() =>
			expect(
				page
					.getByRole("button", { name: "Slot 4: Parsnip" })
					.hasAttribute("disabled"),
			).toBe(false),
		);
		const keyboardChoice = page.getByRole("button", {
			name: "Slot 2: Pickaxe",
		});
		keyboardChoice.focus();
		await fireEvent.click(keyboardChoice, { detail: 0 });
		// Keyboard activation must not consume the pointer-only suppression flag.
		// The following browser-generated click still belongs to the completed drag.
		await fireEvent.click(source, { detail: 1 });
		expect(keyboardChoice.getAttribute("aria-pressed")).toBe("true");
		expect(document.activeElement).toBe(keyboardChoice);
	} finally {
		hit.mockRestore();
		page.unmount();
		await opened.close();
	}
});
