import { expect, it } from "vitest";
import { Effect, Result } from "effect";
import { vi } from "vitest";
import { fixtureXml } from "./fixtures";
import { get } from "svelte/store";
import { openEditor } from "../../src/lib/editor/editor-model.ts";
import {
	setCalendarDate,
	setCalendarWeather,
} from "../../src/lib/editor/calendar-operations.ts";

const input = async () => new TextEncoder().encode(fixtureXml);

it("command results retain expected errors without reporting defects", async () => {
	const report = vi.spyOn(console, "error").mockImplementation(() => {});
	const opened = await openEditor(await input());
	try {
		const before = await opened.model.snapshot();
		const result = await opened.model.commands.transact(
			setCalendarWeather("today", "invalid"),
		);
		expect(result && Result.isFailure(result) && result.failure._tag).toBe(
			"CalendarRuleViolation",
		);
		expect(await opened.model.snapshot()).toEqual(before);
		expect(report).not.toHaveBeenCalled();
	} finally {
		await opened.close();
		report.mockRestore();
	}
});

it("a defect after staged writes reports once, clears pending and preserves redo; later edits work", async () => {
	const report = vi.spyOn(console, "error").mockImplementation(() => {});
	const opened = await openEditor(await input());
	try {
		await opened.model.commands.transact(setCalendarDate({ year: 3 }));
		await opened.model.commands.undo();
		const before = await opened.model.snapshot();
		const result = await opened.model.commands.transact(
			Effect.gen(function* () {
				yield* setCalendarDate({ year: 4 });
				return yield* Effect.die(new TypeError("test defect"));
			}),
		);
		expect(result).toBeNull();
		expect(await opened.model.snapshot()).toEqual(before);
		expect(report).toHaveBeenCalledTimes(1);
		expect(report.mock.calls[0]?.[1]).toContain("TypeError: test defect");
		const bindings = opened.model.atomBindings;
		expect(bindings.registry.get(bindings.pending)).toBe(0);
		expect(bindings.registry.get(bindings.notice)?.message).toContain(
			"couldn’t be completed",
		);
		const next = await opened.model.commands.redo();
		expect(next && Result.isSuccess(next)).toBe(true);
		expect(get(opened.model.view)?.calendar.date.year).toBe(3);
	} finally {
		await opened.close();
		report.mockRestore();
	}
});

it("closing a session cancels running and queued UI commands without toasts or rejections", async () => {
	const report = vi.spyOn(console, "error").mockImplementation(() => {});
	const opened = await openEditor(await input());
	try {
		const pending = opened.model.commands.transact(Effect.never);
		const queued = opened.model.commands.transact(setCalendarDate({ year: 5 }));
		// Give the first command time to acquire its scoped fiber before closing it.
		await new Promise((resolve) => setTimeout(resolve, 10));
		await opened.close();
		expect(await pending).toBeNull();
		expect(await queued).toBeNull();
		expect(await opened.model.commands.undo()).toBeNull();
		expect(report).not.toHaveBeenCalled();
	} finally {
		await opened.close();
		report.mockRestore();
	}
});
