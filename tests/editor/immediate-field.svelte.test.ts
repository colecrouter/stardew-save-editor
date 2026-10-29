import { fireEvent, render, waitFor } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import { Result } from "effect";
import type { ImmediateField } from "../../src/lib/editor/immediate-field.ts";
import type { CommandResult } from "../../src/lib/editor/command-result.ts";
import NumberField from "../../src/lib/editor/ui/fields/NumberField.svelte";
import TextField from "../../src/lib/editor/ui/fields/TextField.svelte";

const testScope = Symbol("test-fields");
type Completion = CommandResult<unknown, { message: string }>;
function deferred() {
	let resolve!: (value: Completion) => void;
	const promise = new Promise<Completion>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}
function numeric(
	overrides: Partial<ImmediateField<number>> = {},
): ImmediateField<number> {
	return {
		scope: testScope,
		key: "test:owner:amount",
		label: "Amount",
		value: 1,
		available: true,
		begin: () => ({ fieldKey: "test:owner:amount" }),
		commit: async () => Result.succeed(undefined),
		end: async () => Result.succeed(undefined),
		...overrides,
	};
}

describe("shared immediate field controller", () => {
	it("keeps the latest queued value and focus while earlier requests complete", async () => {
		const first = deferred(),
			second = deferred();
		const begin = vi.fn(() => ({ fieldKey: "test:owner:amount" }));
		const commit = vi
			.fn()
			.mockReturnValueOnce(first.promise)
			.mockReturnValueOnce(second.promise);
		const end = vi.fn(async () => Result.succeed(undefined));
		const field = numeric({ begin, commit, end });
		const page = render(NumberField, { field });
		const input = page.getByRole("spinbutton") as HTMLInputElement;
		input.focus();
		await fireEvent.input(input, { target: { value: "2" } });
		await fireEvent.input(input, { target: { value: "3" } });
		await page.rerender({ field: { ...field, value: 2 } });
		first.resolve(Result.succeed(undefined));
		await waitFor(() => expect(input.value).toBe("3"));
		expect(document.activeElement).toBe(input);
		await page.rerender({ field: { ...field, value: 3 } });
		second.resolve(Result.succeed(undefined));
		await waitFor(() => expect(input.value).toBe("3"));
		expect(begin).toHaveBeenCalledTimes(1);
		await fireEvent.blur(input);
		expect(end).toHaveBeenCalledTimes(1);
		page.unmount();
	});

	it("clears a rejected edit when corrected to the committed value without another command", async () => {
		const commit = vi.fn(async () =>
			Result.fail({ message: "Choose a positive amount." }),
		);
		const page = render(NumberField, { field: numeric({ commit }) });
		const input = page.getByRole("spinbutton") as HTMLInputElement;
		await fireEvent.input(input, { target: { value: "0" } });
		await waitFor(() =>
			expect(input.getAttribute("aria-invalid")).toBe("true"),
		);
		expect(input.value).toBe("1");
		await fireEvent.input(input, { target: { value: "1" } });
		await waitFor(() => expect(input.getAttribute("aria-invalid")).toBeNull());
		expect(commit).toHaveBeenCalledTimes(1);
		page.unmount();
	});

	it("keeps numeric replacement blanks local and restores them on blur", async () => {
		const commit = vi.fn(async () => Result.succeed(undefined));
		const page = render(NumberField, { field: numeric({ commit }) });
		const input = page.getByRole("spinbutton") as HTMLInputElement;
		await fireEvent.input(input, { target: { value: "" } });
		expect(input.value).toBe("");
		expect(commit).not.toHaveBeenCalled();
		await fireEvent.blur(input);
		expect(input.value).toBe("1");
		page.unmount();
	});

	it("captures the original target and ignores its late failure after replacement", async () => {
		const pending = deferred();
		const commit = vi.fn<ImmediateField<number>["commit"]>(
			() => pending.promise,
		);
		const end = vi.fn(async () => Result.succeed(undefined));
		const page = render(NumberField, { field: numeric({ commit, end }) });
		const input = page.getByRole("spinbutton") as HTMLInputElement;
		await fireEvent.input(input, { target: { value: "2" } });
		await page.rerender({
			field: numeric({ key: "test:other:amount", value: 7 }),
		});
		await waitFor(() => expect(input.value).toBe("7"));
		expect(end).toHaveBeenCalledTimes(1);
		pending.resolve(Result.fail({ message: "Old target failed." }));
		await waitFor(() => expect(input.getAttribute("aria-invalid")).toBeNull());
		expect(input.value).toBe("7");
		expect(commit.mock.calls[0]?.[0]).toBe(2);
		page.unmount();
	});

	it("keeps required empty text local while allowing optional empty text through", async () => {
		const commit = vi.fn<ImmediateField<string>["commit"]>(async () =>
			Result.succeed(undefined),
		);
		const field: ImmediateField<string> = {
			scope: testScope,
			key: "farm:name",
			label: "Name",
			value: "Old",
			available: true,
			constraints: { required: true },
			begin: () => ({ fieldKey: "farm:name" }),
			commit,
			end: async () => Result.succeed(undefined),
		};
		const page = render(TextField, { field });
		const input = page.getByRole("textbox") as HTMLInputElement;
		await fireEvent.input(input, { target: { value: "" } });
		expect(input.value).toBe("");
		expect(commit).not.toHaveBeenCalled();
		await fireEvent.blur(input);
		expect(input.value).toBe("Old");
		await page.rerender({
			field: { ...field, key: "optional:name", constraints: {} },
		});
		await fireEvent.input(input, { target: { value: "" } });
		await waitFor(() => expect(commit).toHaveBeenCalledTimes(1));
		expect(commit.mock.calls[0]?.[0]).toBe("");
		page.unmount();
	});

	it("does not reuse a gesture when another session presents the same field key", async () => {
		const oldCommit = vi.fn(async () => Result.succeed(undefined));
		const nextCommit = vi.fn(async () => Result.succeed(undefined));
		const page = render(NumberField, { field: numeric({ commit: oldCommit }) });
		await fireEvent.input(page.getByRole("spinbutton"), {
			target: { value: "2" },
		});
		await waitFor(() => expect(oldCommit).toHaveBeenCalledTimes(1));
		await page.rerender({
			field: numeric({
				scope: Symbol("other-session"),
				value: 7,
				commit: nextCommit,
			}),
		});
		await fireEvent.input(page.getByRole("spinbutton"), {
			target: { value: "8" },
		});
		await waitFor(() => expect(nextCommit).toHaveBeenCalledTimes(1));
		expect(oldCommit).toHaveBeenCalledTimes(1);
		page.unmount();
	});
	it("clears rejection feedback when Undo supplies another committed value", async () => {
		const field = numeric({
			commit: async () => Result.fail({ message: "Rejected" }),
		});
		const page = render(NumberField, { field });
		await fireEvent.input(page.getByRole("spinbutton"), {
			target: { value: "-1" },
		});
		await waitFor(() =>
			expect(page.getByRole("spinbutton").getAttribute("aria-invalid")).toBe(
				"true",
			),
		);
		await page.rerender({ field: { ...field, value: 3 } });
		await waitFor(() =>
			expect(
				page.getByRole("spinbutton").getAttribute("aria-invalid"),
			).toBeNull(),
		);
		page.unmount();
	});
});
