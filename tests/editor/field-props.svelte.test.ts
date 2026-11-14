import { render } from "vitest-browser-svelte";
import { userEvent } from "vitest/browser";
import { Effect, Result } from "effect";
import { describe, expect, it, vi } from "vitest";
import type { ImmediateField } from "../../src/lib/editor/immediate-field";
import { MutationError } from "../../src/lib/editor/domain";
import NumberField from "../../src/lib/editor/ui/fields/NumberField.svelte";
import TextField from "../../src/lib/editor/ui/fields/TextField.svelte";
import SelectField from "../../src/lib/editor/ui/fields/SelectField.svelte";
import CheckboxField from "../../src/lib/editor/ui/fields/CheckboxField.svelte";

function field<T extends string | number | boolean>(
	value: T,
): ImmediateField<T> {
	return {
		scope: Symbol("test"),
		key: "test",
		label: "Value",
		value,
		available: true,
		begin: () => ({ fieldKey: "test" }),
		commit: vi.fn(async () => Result.succeed(undefined)),
		end: vi.fn(async () => Result.succeed(undefined)),
	};
}

// Native customization must remain usable without bypassing field ownership or
// replacing the focus/input/blur behavior responsible for history grouping.
// Drive these events with the browser so handler composition follows native order.
describe("shared field native attributes", () => {
	it("forwards number attributes and composes focus/blur with queued editing", async () => {
		const value = field<number>(1),
			onfocus = vi.fn(),
			onblur = vi.fn(),
			oninput = vi.fn();
		const page = await render(NumberField, {
			field: value,
			id: "custom-number",
			"data-testid": "amount",
			description: "Field help",
			"aria-describedby": "external-help",
			"aria-label": "Custom amount",
			class: "custom-control",
			style: "color: red",
			title: "Native title",
			inputmode: "numeric",
			max: 20,
			onfocus,
			onblur,
			oninput,
		});
		const input = page.getByTestId("amount").element() as HTMLInputElement;
		expect(input.id).toBe("custom-number");
		// aria-label supplies the accessible name while the visible native label
		// remains associated with the customized ID and still targets this input.
		expect(
			page.getByRole("spinbutton", { name: "Custom amount" }).element(),
		).toBe(input);
		expect(
			[...(input.labels ?? [])].find((label) => label.textContent === "Value")
				?.control,
		).toBe(input);
		expect(input.getAttribute("aria-describedby")).toBe(
			"external-help custom-number-feedback",
		);
		expect(input.classList.contains("custom-control")).toBe(true);
		expect(input.style.color).toBe("red");
		expect(input.title).toBe("Native title");
		expect(input.max).toBe("20");
		await userEvent.click(input);
		await userEvent.fill(input, "2");
		await userEvent.tab();
		await expect
			.poll(() => value.commit)
			.toHaveBeenCalledWith(2, expect.anything());
		expect(value.end).toHaveBeenCalledTimes(1);
		expect(onfocus).toHaveBeenCalledTimes(1);
		expect(onblur).toHaveBeenCalledTimes(1);
		expect(oninput).toHaveBeenCalledTimes(1);
		await page.unmount();
	});
	it("forwards text attributes while retaining controlled value and label", async () => {
		const value = field<string>("Old"),
			onblur = vi.fn();
		const page = await render(TextField, {
			field: value,
			id: "custom-text",
			"data-testid": "name",
			placeholder: "Name",
			maxlength: 40,
			autocomplete: "off",
			onblur,
		});
		const input = page.getByTestId("name").element() as HTMLInputElement;
		expect(input.placeholder).toBe("Name");
		expect(input.maxLength).toBe(40);
		expect(page.getByLabelText("Value").element()).toBe(input);
		await userEvent.fill(input, "New");
		await userEvent.tab();
		await expect
			.poll(() => value.commit)
			.toHaveBeenCalledWith("New", expect.anything());
		expect(onblur).toHaveBeenCalledTimes(1);
		await page.unmount();
	});
	it("composes native select handlers with its discrete field command", async () => {
		const value = {
			...field<string>("a"),
			options: [
				{ value: "a", label: "First" },
				{ value: "b", label: "Second" },
			],
		};
		const onchange = vi.fn();
		const page = await render(SelectField, {
			field: value,
			id: "custom-select",
			"data-testid": "choice",
			"aria-describedby": "external",
			description: "Options",
			onchange,
			class: "custom-select",
		});
		const select = page.getByTestId("choice").element();
		expect(select.getAttribute("aria-describedby")).toBe(
			"external custom-select-feedback",
		);
		expect(page.getByLabelText("Value").element()).toBe(select);
		await userEvent.selectOptions(select, "b");
		await expect
			.poll(() => value.commit)
			.toHaveBeenCalledWith("b", expect.anything());
		expect(onchange).toHaveBeenCalledTimes(1);
		await page.unmount();
	});
	it("forwards checkbox attributes without allowing availability to be overridden", async () => {
		const value = {
			...field<boolean>(false),
			available: false,
			reason: "Unavailable",
		};
		const page = await render(CheckboxField, {
			field: value,
			"data-testid": "flag",
			disabled: false,
			title: "Native checkbox",
		});
		const input = page.getByTestId("flag").element() as HTMLInputElement;
		expect(input.disabled).toBe(true);
		expect(input.title).toBe("Native checkbox");
		expect(page.getByText("Unavailable").element().id).toBe(
			input.getAttribute("aria-describedby"),
		);
		await page.unmount();
	});
	it("keeps MutationError's constructor and typed failure when yielded directly", async () => {
		const error = new MutationError("Expected rejection");
		let finalized = false;
		const result = await Effect.runPromise(
			Effect.result(
				Effect.scoped(
					Effect.gen(function* () {
						// Directly yielding an expected error must still release its Effect scope.
						yield* Effect.addFinalizer(() =>
							Effect.sync(() => {
								finalized = true;
							}),
						);
						return yield* error;
					}),
				),
			),
		);
		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result)) expect(result.failure).toBe(error);
		expect(finalized).toBe(true);
		expect(error).toBeInstanceOf(Error);
		expect(error._tag).toBe("MutationError");
		expect(error.message).toBe("Expected rejection");
	});
});
