import { expect, it } from "vitest";
import { renderBrowserWorkspace } from "./workspace-browser.ts";
import { childrenFixture } from "./children-fixture.ts";
import { readChildren } from "../../src/lib/editor/children-data.ts";
import { tinyEditorFixture } from "../helpers/editor-document.ts";

it("searches catalog hats, previews a replacement privately and restores focus on Cancel", async () => {
	const opened = await renderBrowserWorkspace(
		childrenFixture(),
		"Relationships",
	);
	try {
		const { page, model } = opened;
		await page.getByRole("tab", { name: "Children (2)" }).click();
		const card = page.getByRole("region", { name: "Juniper child" });
		const trigger = card.getByRole("button", { name: "Edit child" });
		await trigger.click();
		await expect
			.element(card.getByRole("textbox", { name: "New name for Juniper" }))
			.toHaveFocus();
		const hats = card.getByRole("combobox", { name: "Hat", exact: true });
		await hats.click();
		// Establish catalog readiness before filtering. Each locator assertion retries
		// the expected outcome under the shared assertion deadline.
		await expect
			.element(page.getByRole("option", { name: /Straw Hat/ }))
			.toBeVisible();
		await hats.fill("no matching hats");
		await expect.element(page.getByText("No hats found.")).toBeVisible();
		await expect
			.element(page.getByRole("option", { name: /Straw Hat/ }))
			.not.toBeInTheDocument();
		await hats.fill("Straw");
		await page.getByRole("option", { name: /Straw Hat/ }).click();
		await expect.element(hats).toHaveValue("Straw Hat");
		// The portrait is decorative and hidden from accessibility queries. Inspect
		// its metadata to verify that the replacement is previewed before Apply.
		await expect
			.poll(() =>
				card
					.element()
					.querySelector("[data-child-hat]")
					?.getAttribute("data-child-hat"),
			)
			.toBe("Straw Hat");
		expect(
			readChildren((await model.snapshot()).document)[0]?.hat.name,
		).not.toBe("Straw Hat");
		await card.getByRole("button", { name: "Apply child changes" }).click();
		await expect
			.poll(
				async () =>
					readChildren((await model.snapshot()).document)[0]?.hat.name,
			)
			.toBe("Straw Hat");
		expect((await model.snapshot()).entries).toHaveLength(1);
		await card.getByRole("button", { name: "Cancel changes" }).click();
		await expect.element(trigger).toHaveFocus();
		await model.commands.undo();
		expect(
			readChildren((await model.snapshot()).document)[0]?.hat.name,
		).not.toBe("Straw Hat");
	} finally {
		await opened.dispose();
	}
});

it("previews appearance and age privately, then applies the combined child edit once", async () => {
	const opened = await renderBrowserWorkspace(
		childrenFixture(),
		"Relationships",
	);
	try {
		const { page, model } = opened;
		await page.getByRole("tab", { name: "Children (2)" }).click();
		const card = page.getByRole("region", { name: "Juniper child" });
		await card.getByRole("button", { name: "Edit child" }).click();
		await card
			.getByRole("combobox", { name: "Gender", exact: true })
			.selectOptions("Male");
		await card
			.getByRole("combobox", { name: "Skin tone" })
			.selectOptions("light");
		await card
			.getByRole("combobox", { name: "Development stage" })
			.selectOptions("1");
		await expect
			.element(card.getByRole("spinbutton", { name: "Days old" }))
			.toHaveValue(13);
		await expect.element(card.getByText("Baby", { exact: true })).toBeVisible();
		await expect.element(card.getByText("13 days old")).toBeVisible();
		expect(readChildren((await model.snapshot()).document)[0]).toMatchObject({
			gender: "Female",
			daysOld: 64,
		});
		// An existing hat is removed only through the explicit draft selection.
		await card.getByRole("combobox", { name: "Hat", exact: true }).click();
		await page.getByRole("option", { name: /^No hat$/ }).click();
		await expect
			.poll(() => card.element().querySelector("[data-child-hat]"))
			.toBeNull();
		await expect
			.element(card.getByText("Unknown item"))
			.not.toBeInTheDocument();
		await card.getByRole("button", { name: "Apply child changes" }).click();
		await expect
			.poll(async () => readChildren((await model.snapshot()).document)[0])
			.toMatchObject({
				gender: "Male",
				darkSkinned: false,
				daysOld: 13,
				stage: 1,
				hat: { present: false },
			});
		expect((await model.snapshot()).entries).toHaveLength(1);
		await model.commands.undo();
		expect(readChildren((await model.snapshot()).document)[0]).toMatchObject({
			gender: "Female",
			darkSkinned: true,
			daysOld: 64,
			hat: { present: true },
		});
	} finally {
		await opened.dispose();
	}
});

it("retains a private rename draft across relationship tabs", async () => {
	const opened = await renderBrowserWorkspace(
		childrenFixture(),
		"Relationships",
	);
	try {
		const { page, model } = opened;
		await page.getByRole("tab", { name: "Children (2)" }).click();
		await page
			.getByRole("region", { name: "Juniper child" })
			.getByRole("button", { name: "Edit child" })
			.click();
		const input = page.getByRole("textbox", { name: "New name for Juniper" });
		await input.fill("Hazel");
		const original = input.element();
		await page.getByRole("tab", { name: "Friendships" }).click();
		await expect.element(original).not.toBeVisible();
		await page.getByRole("tab", { name: "Children (2)" }).click();
		// Node identity proves that tab changes preserve the mounted private draft.
		expect(input.element()).toBe(original);
		await expect.element(input).toHaveValue("Hazel");
		expect((await model.snapshot()).entries).toHaveLength(0);
	} finally {
		await opened.dispose();
	}
});

it("explains an empty Children tab without presenting rename controls", async () => {
	const opened = await renderBrowserWorkspace(
		tinyEditorFixture(),
		"Relationships",
	);
	try {
		await opened.page.getByRole("tab", { name: "Children (0)" }).click();
		await expect
			.element(opened.page.getByText("No children in this save"))
			.toBeVisible();
		await expect
			.element(opened.page.getByRole("button", { name: "Edit child" }))
			.not.toBeInTheDocument();
	} finally {
		await opened.dispose();
	}
});

it("keeps typing private, applies one rename, and restores it with Undo/Redo", async () => {
	const opened = await renderBrowserWorkspace(
		childrenFixture(),
		"Relationships",
	);
	try {
		const { page, model } = opened;
		await page.getByRole("tab", { name: "Children (2)" }).click();
		await page
			.getByRole("region", { name: "Juniper child" })
			.getByRole("button", { name: "Edit child" })
			.click();
		const input = page.getByRole("textbox", { name: "New name for Juniper" });
		await input.fill("Hazel");
		const original = input.element();
		expect(readChildren((await model.snapshot()).document)[0]?.name).toBe(
			"Juniper",
		);
		await page
			.getByRole("region", { name: "Juniper child" })
			.getByRole("button", { name: "Apply child changes" })
			.click();
		const renamed = page.getByRole("textbox", { name: "New name for Hazel" });
		await expect.element(renamed).toBeInTheDocument();
		expect(renamed.element()).toBe(original);
		expect((await model.snapshot()).entries).toHaveLength(1);
		await model.commands.undo();
		await expect.element(input).toBeInTheDocument();
		await model.commands.redo();
		await expect.element(renamed).toBeInTheDocument();
	} finally {
		await opened.dispose();
	}
});

it("retains a rejected name for correction and lets Cancel abandon the draft", async () => {
	const opened = await renderBrowserWorkspace(
		childrenFixture(),
		"Relationships",
	);
	try {
		const { page, model } = opened;
		await page.getByRole("tab", { name: "Children (2)" }).click();
		const card = page.getByRole("region", { name: "Juniper child" });
		await card.getByRole("button", { name: "Edit child" }).click();
		const input = card.getByRole("textbox", { name: "New name for Juniper" });
		await input.fill("Rowan");
		await card.getByRole("button", { name: "Apply child changes" }).click();
		await expect
			.element(card.getByRole("status"))
			.toMatchTextContent(/already identifies/);
		await expect.element(input).toHaveValue("Rowan");
		expect((await model.snapshot()).entries).toHaveLength(0);
		await card.getByRole("button", { name: "Cancel changes" }).click();
		await card.getByRole("button", { name: "Edit child" }).click();
		await expect.element(input).toHaveValue("Juniper");
	} finally {
		await opened.dispose();
	}
});

it("rejects a draft after another edit rather than refreshing its captured revision", async () => {
	const opened = await renderBrowserWorkspace(
		childrenFixture(),
		"Relationships",
	);
	try {
		const { page, model } = opened;
		await page.getByRole("tab", { name: "Children (2)" }).click();
		const first = page.getByRole("region", { name: "Juniper child" });
		const second = page.getByRole("region", { name: "Rowan child" });
		await first.getByRole("button", { name: "Edit child" }).click();
		await second.getByRole("button", { name: "Edit child" }).click();
		await first
			.getByRole("textbox", { name: "New name for Juniper" })
			.fill("Hazel");
		await second
			.getByRole("textbox", { name: "New name for Rowan" })
			.fill("Willow");
		const secondInput = second
			.getByRole("textbox", { name: "New name for Rowan" })
			.element();
		await second.getByRole("button", { name: "Apply child changes" }).click();
		// Observe queued publication before submitting the other captured draft.
		const renamed = page.getByRole("textbox", { name: "New name for Willow" });
		await expect.element(renamed).toBeInTheDocument();
		expect(renamed.element()).toBe(secondInput);
		await first.getByRole("button", { name: "Apply child changes" }).click();
		await expect.element(first.getByRole("status")).not.toBeEmptyDOMElement();
		expect(
			readChildren((await model.snapshot()).document).map(
				(child) => child.name,
			),
		).toEqual(["Juniper", "Willow"]);
		expect((await model.snapshot()).entries).toHaveLength(1);
	} finally {
		await opened.dispose();
	}
});
