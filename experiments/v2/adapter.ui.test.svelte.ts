import { expect, it } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import { Atom, AtomRegistry } from "effect/reactivity";
import type { EditorModel, EditorView } from "./editor-model.ts";
import AdapterLifecycleProbe from "./ui/testing/AdapterLifecycleProbe.svelte";

it("mounted Atom readers follow a model replacement within their provider registry", async () => {
	const registry = AtomRegistry.make();
	// Both feature models belong to the same provider. Registry replacement remains
	// a separate, keyed file-scope lifecycle, rather than a reactive hook operation.
	const modelFor = (day: number) =>
		({
			atomBindings: {
				registry,
				view: Atom.make({ calendar: { date: { day } } } as EditorView),
				pending: Atom.make(0),
				notice: Atom.make(undefined),
			},
		}) satisfies Pick<EditorModel, "atomBindings">;
	let model = $state.raw(modelFor(2));
	const target = document.createElement("div");
	document.body.append(target);
	const component = mount(AdapterLifecycleProbe, {
		target,
		props: {
			get model() {
				return model;
			},
		},
	});
	try {
		flushSync();
		expect(
			target.querySelector('[aria-label="Adapter day"]')?.textContent?.trim(),
		).toBe("2");
		model = modelFor(8);
		flushSync();
		expect(
			target.querySelector('[aria-label="Adapter day"]')?.textContent?.trim(),
		).toBe("8");
	} finally {
		await unmount(component);
		target.remove();
		registry.dispose();
	}
});

it("a centrally handled defect shows one toast and the mounted UI can keep editing", async () => {
	const { readFile } = await import("node:fs/promises");
	const { Effect, Result } = await import("effect");
	const { vi } = await import("vitest");
	const { openEditor } = await import("./editor-model.ts");
	const { setCalendarDate } = await import("./calendar-operations.ts");
	const { default: Probe } =
		await import("./ui/testing/CommandBoundaryProbe.svelte");
	const report = vi.spyOn(console, "error").mockImplementation(() => {});
	const opened = await openEditor(await readFile("../../tests/TestSave"));
	const target = document.createElement("div");
	document.body.append(target);
	const component = mount(Probe, { target, props: { model: opened.model } });
	try {
		flushSync();
		expect(
			await opened.model.commands.transact(
				Effect.die(new Error("test defect")),
			),
		).toBeNull();
		flushSync();
		expect(target.querySelectorAll(".toast")).toHaveLength(1);
		const outcome = await opened.model.commands.transact(
			setCalendarDate({ day: 8 }),
		);
		flushSync();
		expect(outcome && Result.isSuccess(outcome)).toBe(true);
		expect(
			target.querySelector('[aria-label="Adapter day"]')?.textContent?.trim(),
		).toBe("8");
		expect(
			target
				.querySelector('[aria-label="Adapter pending"]')
				?.textContent?.trim(),
		).toBe("0");
		expect(report).toHaveBeenCalledTimes(1);
	} finally {
		await unmount(component);
		await opened.close();
		target.remove();
		report.mockRestore();
	}
});
