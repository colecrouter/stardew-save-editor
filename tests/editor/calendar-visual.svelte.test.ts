import { Result } from "effect";
import { expect, it, vi } from "vitest";
import { fireEvent, render, waitFor, within } from "@testing-library/svelte";
import { openEditor } from "../../src/lib/editor/editor-model";
import { calendarEventsForMonth } from "../../src/lib/editor/calendar-events";
import CharacterHarness from "./CharacterHarness.svelte";
import { CalendarSeason } from "../../src/lib/calendarSeason";
import { fixtureXml } from "./fixtures";

it(
	"previews calendar events without writing until Apply and restores the saved date with Undo",
	{ timeout: 20000 },
	async () => {
		const opened = await openEditor(new TextEncoder().encode(fixtureXml));
		const page = render(CharacterHarness, { model: opened.model });
		try {
			await fireEvent.click(
				page.getByRole("link", { name: "Date and weather" }),
			);
			const days = await page.findByRole(
				"group",
				{ name: "Day of month" },
				{ timeout: 10000 },
			);
			const before = await opened.model.snapshot();
			const egg = within(days).getByRole("button", {
				name: /^13:.*Egg Festival/,
			});
			await fireEvent.click(egg);
			expect(egg.getAttribute("aria-pressed")).toBe("true");
			expect(
				within(days)
					.getByRole("button", { current: "date" })
					.getAttribute("aria-pressed"),
			).toBe("false");
			expect(page.getByText("Egg Festival", { selector: "li" })).toBeTruthy();
			expect((await opened.model.snapshot()).document).toEqual(before.document);
			expect((await opened.model.snapshot()).entries).toEqual(before.entries);
			await fireEvent.input(page.getByRole("spinbutton", { name: "Year" }), {
				target: { value: "3" },
			});
			await fireEvent.input(page.getByRole("spinbutton", { name: "Year" }), {
				target: { value: "" },
			});
			expect(
				page.getByText(
					"Calendar events are unavailable until the year is valid.",
				),
			).toBeTruthy();
			expect((await opened.model.snapshot()).entries).toEqual(before.entries);
			await fireEvent.input(page.getByRole("spinbutton", { name: "Year" }), {
				target: { value: "3" },
			});
			// The complete month is projected from the draft, including seed-based visits,
			// while the saved date/weather remain untouched until explicit submission.
			const current = opened.model.atomBindings.registry.get(
				opened.model.atomBindings.view,
			);
			if (!current) throw new Error("Missing editor view");
			const context = current.calendarEventContext;
			const expected = calendarEventsForMonth(
				{
					year: 3,
					season: CalendarSeason.Spring,
				},
				context,
			).filter((event) => event.kind === "bookseller");
			for (const event of expected)
				expect(
					within(days).getByRole("button", {
						name: new RegExp(`^${event.day}:.*Bookseller`),
					}),
				).toBeTruthy();
			await fireEvent.click(page.getByRole("button", { name: "Apply date" }));
			await waitFor(async () =>
				expect(
					opened.model.atomBindings.registry.get(opened.model.atomBindings.view)
						?.calendar.date.day,
				).toBe(13),
			);
			expect((await opened.model.snapshot()).entries).toHaveLength(
				before.entries.length + 1,
			);
			await fireEvent.click(page.getByRole("button", { name: "Undo" }));
			await waitFor(async () =>
				expect((await opened.model.snapshot()).document).toEqual(
					before.document,
				),
			);
		} finally {
			page.unmount();
			await opened.close();
		}
	},
);

it.each(["failure", "noncompletion"] as const)(
	"restores committed weather after %s",
	async (outcome) => {
		const opened = await openEditor(new TextEncoder().encode(fixtureXml));
		const page = render(CharacterHarness, { model: opened.model });
		try {
			await fireEvent.click(
				page.getByRole("link", { name: "Date and weather" }),
			);
			const select = page.getByRole("combobox", {
				name: "Today",
			}) as HTMLSelectElement;
			const before = select.value;
			const alternative = [...select.options].find(
				(option) => !option.disabled && option.value !== before,
			);
			if (!alternative) throw new Error("Expected another allowed weather");
			// No publication follows a refused command, so this exercises the native
			// DOM value that Svelte's unchanged projection cannot repair by itself.
			const refused = vi
				.spyOn(opened.model.commands, "transact")
				.mockResolvedValue(
					outcome === "failure"
						? Result.fail({
								_tag: "CalendarRuleViolation",
								message: "Refused weather",
							})
						: null,
				);
			await fireEvent.change(select, { target: { value: alternative.value } });
			await waitFor(() => expect(select.value).toBe(before));
			if (outcome === "failure")
				expect(page.getByText("Refused weather")).toBeTruthy();
			refused.mockRestore();
		} finally {
			page.unmount();
			await opened.close();
		}
	},
);
