import { render } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import BuildingSprite from "../src/lib/ui/BuildingSprite.svelte";

vi.mock("$app/paths", () => ({
	// Kit 3 accepts asset-relative paths and inserts the deployment separator.
	// Exercise the same non-root deployment used by GitHub Pages.
	asset: (file: string) => `/stardew-save-editor/${file}`,
}));

const sprite = (container: HTMLElement) => {
	const node = container.querySelector<HTMLElement>(".item");
	if (!node) throw new Error("Expected a building sprite");
	return node;
};

describe("BuildingSprite", () => {
	it("uses the deployment base for both building and scenery assets", () => {
		const { container } = render(BuildingSprite, {
			building: { name: "Shipping Bin" },
		});
		expect(sprite(container).style.getPropertyValue("--sprite")).toBe(
			'url("/stardew-save-editor/assets/buildings/Shipping Bin.png")',
		);
		expect(
			container
				.querySelector<HTMLElement>(".wrapper")
				?.style.getPropertyValue("--scenery"),
		).toBe('url("/stardew-save-editor/assets/daybg.png")');
	});

	it.each([
		["Farmhouse", 160, 144],
		["Junimo Hut", 48, 64],
		["Fish Pond", 80, 80],
	])("keeps the complete %s menu frame", (name, width, height) => {
		const { container } = render(BuildingSprite, { building: { name } });
		const node = sprite(container);
		expect(node.style.width).toBe(`${width}px`);
		expect(node.style.height).toBe(`${height}px`);
	});

	it("selects the repaired greenhouse unless the unlock flag explicitly selects ruins", async () => {
		const { container, rerender } = render(BuildingSprite, {
			building: { name: "Greenhouse" },
		});
		// Cropping a nonzero source rectangle moves the image up, never down.
		expect(sprite(container).style.getPropertyValue("--y")).toBe("-160px");
		await rerender({ building: { name: "Greenhouse", repaired: false } });
		expect(sprite(container).style.getPropertyValue("--y")).toBe("0px");
		await rerender({ building: { name: "Greenhouse", repaired: true } });
		expect(sprite(container).style.getPropertyValue("--y")).toBe("-160px");
	});

	it("uses the complete pet bowl illustration including its platform", () => {
		const { container } = render(BuildingSprite, {
			building: { name: "Pet Bowl" },
		});
		expect(sprite(container).style.getPropertyValue("--x")).toBe("0px");
	});

	it("reserves one requested square while an upgrade changes source aspect ratio", async () => {
		const { container, rerender } = render(BuildingSprite, {
			building: { name: "Coop" },
			size: 128,
		});
		const frame = container.querySelector<HTMLElement>(".wrapper");
		expect(frame?.style.getPropertyValue("--size")).toBe("128px");
		expect(sprite(container).style.getPropertyValue("--scale")).toBe(
			String(128 / 112),
		);
		await rerender({ building: { name: "Silo" }, size: 128 });
		expect(frame?.style.getPropertyValue("--size")).toBe("128px");
		expect(sprite(container).style.width).toBe("48px");
		expect(sprite(container).style.height).toBe("128px");
		expect(sprite(container).style.getPropertyValue("--sprite")).toContain(
			"Silo.png",
		);
	});

	it("keeps unknown buildings in the same bounded thumbnail without requesting an invented asset", () => {
		const { container, getByTitle } = render(BuildingSprite, {
			building: { name: "Modded tower" },
			size: 48,
		});
		expect(
			container
				.querySelector<HTMLElement>(".wrapper")
				?.style.getPropertyValue("--size"),
		).toBe("48px");
		expect(getByTitle("Preview unavailable").textContent).toBe("?");
		expect(container.querySelector(".item")).toBeNull();
	});
});
