import { render, waitFor } from "@testing-library/svelte";
import { expect, it } from "vitest";

import AchievementIcon from "../../src/lib/editor/ui/AchievementIcon.svelte";
import { requireInstance } from "../helpers/assertions.ts";

it.each([false, true])(
	"loads the shipped achievement artwork with recorded=%s",
	async (recorded) => {
		const { container, unmount } = render(AchievementIcon, {
			id: 40,
			recorded,
		});
		try {
			// Exercise the real manifest and image request: file-presence checks alone
			// cannot detect a renderer silently replacing valid artwork with its fallback.
			const image = requireInstance(
				container.querySelector("img"),
				HTMLImageElement,
			);
			expect(image.getAttribute("src")).toContain(
				`assets/achievements/40${recorded ? "" : "-locked"}.jpg`,
			);
			await waitFor(() => expect(image.naturalWidth).toBeGreaterThan(0));
		} finally {
			unmount();
		}
	},
);

it("pixelates concealed artwork and restores the sharp icon when revealed", async () => {
	const { container, rerender, unmount } = render(AchievementIcon, {
		id: 40,
		recorded: false,
		concealed: true,
	});
	try {
		// Verify real sampled pixels, rather than accepting an empty canvas as
		// successful concealment. The original image must remain visually hidden.
		const canvas = requireInstance(
			container.querySelector("canvas"),
			HTMLCanvasElement,
		);
		const image = requireInstance(
			container.querySelector("img"),
			HTMLImageElement,
		);
		expect([canvas.width, canvas.height]).toEqual([6, 6]);
		await waitFor(() => {
			const pixels = canvas.getContext("2d")?.getImageData(0, 0, 6, 6).data;
			expect(pixels?.some((channel) => channel > 0)).toBe(true);
		});
		expect(getComputedStyle(image).opacity).toBe("0");
		expect(getComputedStyle(canvas).imageRendering).toBe("pixelated");
		await rerender({ id: 40, recorded: false, concealed: false });
		expect(container.querySelector("canvas")).toBeNull();
		expect(getComputedStyle(image).opacity).toBe("1");
		// Re-concealing an already-loaded image must paint the newly mounted canvas.
		await rerender({ id: 40, recorded: false, concealed: true });
		await waitFor(() => {
			const restored = requireInstance(
				container.querySelector("canvas"),
				HTMLCanvasElement,
			);
			expect(
				restored
					.getContext("2d")
					?.getImageData(0, 0, 6, 6)
					.data.some((channel) => channel > 0),
			).toBe(true);
		});
	} finally {
		unmount();
	}
});
