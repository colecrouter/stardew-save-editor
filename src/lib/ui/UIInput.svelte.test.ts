import { fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, test } from "vitest";
import UiInput from "./UIInput.svelte";

const type = async (input: HTMLInputElement, value: string) => {
	await fireEvent.input(input, { target: { value } });
	await tick();
};

describe("UI input", () => {
	test("keeps out-of-range text while typing toward a valid number", async () => {
		render(UiInput, {
			type: "number",
			min: 23,
			max: 38,
			value: 30,
			"data-testid": "input",
		});
		const input = screen.getByTestId("input") as HTMLInputElement;

		// "2" is below the minimum, but it's on the way to "25"
		await type(input, "2");
		expect(input.value).toBe("2");

		await type(input, "25");
		expect(input.value).toBe("25");
	});

	test("can type a new number after backspacing to empty", async () => {
		render(UiInput, {
			type: "number",
			min: 13,
			max: 28,
			value: 21,
			"data-testid": "input",
		});
		const input = screen.getByTestId("input") as HTMLInputElement;

		// Backspace "21" -> "2" -> ""
		await type(input, "2");
		await type(input, "");
		expect(input.value).toBe("");

		await type(input, "2");
		expect(input.value).toBe("2");
		await type(input, "25");
		expect(input.value).toBe("25");
	});

	test("never ends up empty after invalid text, erasing it, and invalid text again", async () => {
		render(UiInput, {
			type: "number",
			min: 13,
			max: 28,
			value: 21,
			"data-testid": "input",
		});
		const input = screen.getByTestId("input") as HTMLInputElement;

		await type(input, "5");
		await type(input, "");
		await type(input, "5");
		await fireEvent.blur(input);
		await tick();

		// Nothing valid was stored after the input was cleared, so it falls back to the minimum
		expect(input.value).toBe("13");
		expect(input.checkValidity()).toBe(true);
	});

	test("restores the stored value when leaving invalid text", async () => {
		render(UiInput, {
			type: "number",
			min: 23,
			max: 38,
			value: 30,
			"data-testid": "input",
		});
		const input = screen.getByTestId("input") as HTMLInputElement;

		await type(input, "5");
		expect(input.value).toBe("5");

		await fireEvent.blur(input);
		await tick();
		expect(input.value).toBe("30");
	});

	const textLike = ["search", "email", "url", "tel", "password"];
	test.each(textLike)("styles %s inputs like text inputs", (inputType) => {
		render(UiInput, { type: "text", value: "", "data-testid": "text" });
		render(UiInput, { type: inputType, value: "", "data-testid": "input" });
		const look = (id: string) => {
			const style = getComputedStyle(screen.getByTestId(id));
			return [style.backgroundColor, style.borderRadius, style.boxShadow];
		};

		// The component's styles reach the test DOM
		expect(look("text")[0]).toBe("#f9bb65");
		expect(look("input")).toEqual(look("text"));
	});
});
