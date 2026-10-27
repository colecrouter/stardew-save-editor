import { expect, it, vi } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/svelte";
import EditorApp from "../../src/lib/editor/ui/EditorApp.svelte";
import { fixtureXml } from "./fixtures";

it("farm drafts persist across navigation, block export and conflict with newer calendar actions", async () => {
	const page = render(EditorApp);
	try {
		await fireEvent.change(page.getByLabelText("Save file"), {
			target: { files: [new File([fixtureXml], "Farm_123")] },
		});
		await waitFor(
			() =>
				expect(page.getByRole("link", { name: "Farm settings" })).toBeTruthy(),
			{ timeout: 5000 },
		);
		await fireEvent.click(page.getByRole("link", { name: "Farm settings" }));
		const name = page.getByRole("textbox", {
			name: "Farm name",
		}) as HTMLInputElement;
		await fireEvent.input(name, { target: { value: "Draft Farm" } });
		expect(
			page
				.getByRole("button", { name: "Export save" })
				.hasAttribute("disabled"),
		).toBe(true);
		await fireEvent.click(page.getByRole("link", { name: "Date and weather" }));
		const year = page.getByRole("spinbutton", { name: "Year" });
		await fireEvent.input(year, { target: { value: "3" } });
		await fireEvent.click(page.getByRole("button", { name: "Apply date" }));
		await waitFor(
			() => expect(page.getByText(/Current save:.*Year 3/)).toBeTruthy(),
			{ timeout: 5000 },
		);
		await fireEvent.click(page.getByRole("link", { name: "Farm settings" }));
		expect(name.value).toBe("Draft Farm");
		expect(page.getByText(/Your farm settings draft is kept/)).toBeTruthy();
		expect(
			page
				.getByRole("button", { name: "Apply farm settings" })
				.hasAttribute("disabled"),
		).toBe(true);
		await fireEvent.click(
			page.getByRole("button", { name: "Reload farm settings" }),
		);
		await fireEvent.input(name, { target: { value: "Applied Farm" } });
		await fireEvent.input(
			page.getByRole("spinbutton", { name: "Profit margin (%)" }),
			{ target: { value: "75" } },
		);
		await fireEvent.click(
			page.getByRole("checkbox", { name: "Spawn monsters on the farm" }),
		);
		const rewards = page.getByRole("combobox", {
			name: "Mine rewards",
		}) as HTMLSelectElement;
		// Happy DOM 20 implements :checked for inputs but omits selected options.
		// Supply that browser selector contract while exercising Svelte's actual
		// function binding; browser validation also covers this control directly.
		const query = rewards.querySelector.bind(rewards);
		const selectedOption = vi
			.spyOn(rewards, "querySelector")
			.mockImplementation(((selector: string) =>
				selector === ":checked"
					? rewards.selectedOptions.item(0)
					: query(selector)) as typeof rewards.querySelector);
		try {
			await fireEvent.change(rewards, { target: { value: "Remixed" } });
		} finally {
			selectedOption.mockRestore();
		}
		await fireEvent.click(
			page.getByRole("button", { name: "Apply farm settings" }),
		);
		await waitFor(() =>
			expect(page.getByText("Farm settings match the save.")).toBeTruthy(),
		);
		expect(name.value).toBe("Applied Farm");
		expect(
			(
				page.getByRole("spinbutton", {
					name: "Profit margin (%)",
				}) as HTMLInputElement
			).value,
		).toBe("75");
		expect(
			(
				page.getByRole("checkbox", {
					name: "Spawn monsters on the farm",
				}) as HTMLInputElement
			).checked,
		).toBe(true);
		expect(
			(
				page.getByRole("combobox", {
					name: "Mine rewards",
				}) as HTMLSelectElement
			).value,
		).toBe("Remixed");
		expect(
			page
				.getByRole("button", { name: "Export save" })
				.hasAttribute("disabled"),
		).toBe(false);
		// Creation settings expose explanations, never writable controls for topology,
		// random seed or wallet transformations that the game owns.
		expect(page.getByText("Farm creation settings")).toBeTruthy();
		expect(page.queryByRole("textbox", { name: "Random seed" })).toBeNull();
	} finally {
		page.unmount();
	}
});
