import { render } from "vitest-browser-svelte";
import { userEvent } from "vitest/browser";
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

// Fill and Tab exercise native input/focus/blur ordering; deferred completions
// keep publication races controlled without adding clock-based waits.
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
		const page = await render(NumberField, { field });
		const input = page.getByRole("spinbutton").element() as HTMLInputElement;
		input.focus();
		await userEvent.fill(input, "2");
		await userEvent.fill(input, "3");
		await page.rerender({ field: { ...field, value: 2 } });
		first.resolve(Result.succeed(undefined));
		await expect.element(input).toHaveValue(3);
		expect(document.activeElement).toBe(input);
		await page.rerender({ field: { ...field, value: 3 } });
		second.resolve(Result.succeed(undefined));
		await expect.element(input).toHaveValue(3);
		expect(begin).toHaveBeenCalledTimes(1);
		await userEvent.tab();
		expect(end).toHaveBeenCalledTimes(1);
		await page.unmount();
	});

	it("clears a rejected edit when corrected to the committed value without another command", async () => {
		const commit = vi.fn(async () =>
			Result.fail({ message: "Choose a positive amount." }),
		);
		const page = await render(NumberField, { field: numeric({ commit }) });
		const input = page.getByRole("spinbutton").element() as HTMLInputElement;
		await userEvent.fill(input, "0");
		await expect.element(input).toHaveAttribute("aria-invalid", "true");
		expect(input.value).toBe("1");
		await userEvent.fill(input, "1");
		await expect.element(input).not.toHaveAttribute("aria-invalid");
		expect(commit).toHaveBeenCalledTimes(1);
		await page.unmount();
	});

	it("keeps numeric replacement blanks local and restores them on blur", async () => {
		const commit = vi.fn(async () => Result.succeed(undefined));
		const page = await render(NumberField, { field: numeric({ commit }) });
		const input = page.getByRole("spinbutton").element() as HTMLInputElement;
		await userEvent.fill(input, "");
		expect(input.value).toBe("");
		expect(commit).not.toHaveBeenCalled();
		await userEvent.tab();
		expect(input.value).toBe("1");
		await page.unmount();
	});

	it("captures the original target and ignores its late failure after replacement", async () => {
		const pending = deferred();
		const commit = vi.fn<ImmediateField<number>["commit"]>(
			() => pending.promise,
		);
		const end = vi.fn(async () => Result.succeed(undefined));
		const page = await render(NumberField, { field: numeric({ commit, end }) });
		const input = page.getByRole("spinbutton").element() as HTMLInputElement;
		await userEvent.fill(input, "2");
		await page.rerender({
			field: numeric({ key: "test:other:amount", value: 7 }),
		});
		await expect.element(input).toHaveValue(7);
		expect(end).toHaveBeenCalledTimes(1);
		pending.resolve(Result.fail({ message: "Old target failed." }));
		await expect.element(input).not.toHaveAttribute("aria-invalid");
		expect(input.value).toBe("7");
		expect(commit.mock.calls[0]?.[0]).toBe(2);
		await page.unmount();
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
		const page = await render(TextField, { field });
		const input = page.getByRole("textbox").element() as HTMLInputElement;
		await userEvent.fill(input, "");
		expect(input.value).toBe("");
		expect(commit).not.toHaveBeenCalled();
		await userEvent.tab();
		expect(input.value).toBe("Old");
		await page.rerender({
			field: { ...field, key: "optional:name", constraints: {} },
		});
		await userEvent.fill(input, "");
		await expect.poll(() => commit).toHaveBeenCalledTimes(1);
		expect(commit.mock.calls[0]?.[0]).toBe("");
		await page.unmount();
	});

	it("does not reuse a gesture when another session presents the same field key", async () => {
		const oldCommit = vi.fn(async () => Result.succeed(undefined));
		const nextCommit = vi.fn(async () => Result.succeed(undefined));
		const page = await render(NumberField, {
			field: numeric({ commit: oldCommit }),
		});
		await userEvent.fill(page.getByRole("spinbutton").element(), "2");
		await expect.poll(() => oldCommit).toHaveBeenCalledTimes(1);
		await page.rerender({
			field: numeric({
				scope: Symbol("other-session"),
				value: 7,
				commit: nextCommit,
			}),
		});
		await userEvent.fill(page.getByRole("spinbutton").element(), "8");
		await expect.poll(() => nextCommit).toHaveBeenCalledTimes(1);
		expect(oldCommit).toHaveBeenCalledTimes(1);
		await page.unmount();
	});
	it("clears rejection feedback when Undo supplies another committed value", async () => {
		const field = numeric({
			commit: async () => Result.fail({ message: "Rejected" }),
		});
		const page = await render(NumberField, { field });
		await userEvent.fill(page.getByRole("spinbutton").element(), "-1");
		await expect
			.element(page.getByRole("spinbutton"))
			.toHaveAttribute("aria-invalid", "true");
		await page.rerender({ field: { ...field, value: 3 } });
		await expect
			.element(page.getByRole("spinbutton"))
			.not.toHaveAttribute("aria-invalid");
		await page.unmount();
	});
});
