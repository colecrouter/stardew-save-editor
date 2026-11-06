import { readItemVisual } from "../../src/lib/editor/item-presentation.ts";
import { expect, it } from "vitest";
import { render } from "@testing-library/svelte";
import BackpackItemVisual from "../../src/lib/editor/ui/BackpackItemVisual.svelte";

it.each([
	undefined,
	Object.freeze({ itemId: "mod.unknown", "@_xsi:type": "ModdedItem" }),
])(
	"distinguishes unreadable item pictures from empty slots without changing saved data",
	(raw) => {
		const before = raw && structuredClone(raw);
		const page = render(BackpackItemVisual, { visual: readItemVisual(raw) });
		try {
			expect(page.container.querySelector("svg.unknown-item")).toBeTruthy();
			expect(page.container.textContent).toContain("Saved data is preserved");
			expect(raw).toEqual(before);
		} finally {
			page.unmount();
		}
	},
);
