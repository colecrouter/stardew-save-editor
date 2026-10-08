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
});
