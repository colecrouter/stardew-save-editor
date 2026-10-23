import { render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dispose } from "$lib/proxies";
import { Friendship } from "$lib/proxies/Friendship.svelte";
import HeartBar from "../src/routes/(edit)/relationships/HeartBar.svelte";

// happy-dom doesn't load images: report each portrait sheet as loaded, this wide
const stubPortraits = (naturalWidth: number) => {
	const requested: string[] = [];
	vi.stubGlobal(
		"Image",
		class {
			naturalWidth = naturalWidth;
			onload?: () => void;
			set src(value: string) {
				requested.push(value);
				queueMicrotask(() => this.onload?.());
			}
		},
	);
	return requested;
};

const renderRow = async (name: string) => {
	const npc = Friendship.fromName(name);
	const view = render(HeartBar, { props: { name, npc } });
	const portrait = screen.getByRole("img", { name: `${name} portrait` });
	// Loaded: the initial shown in its place is gone
	await vi.waitFor(() => expect(portrait.querySelector("strong")).toBeNull());
	await tick();
	return {
		portrait,
		cleanup: () => {
			view.unmount();
			npc[Dispose]?.();
		},
	};
};

describe("Villager portrait", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("shows the villager's initial until the portrait loads", () => {
		// An image that never loads, like a modded villager without a portrait
		vi.stubGlobal("Image", class {});
		const npc = Friendship.fromName("Abigail");
		const view = render(HeartBar, { props: { name: "Abigail", npc } });

		const portrait = screen.getByRole("img", { name: "Abigail portrait" });
		expect(portrait.style.backgroundImage).toBe("");
		expect(portrait.textContent?.trim()).toBe("A");
		view.unmount();
		npc[Dispose]?.();
	});

	it("scales the portrait sheet so one frame fills the box", async () => {
		// Most sheets are two 64px frames wide
		stubPortraits(128);
		const abigail = await renderRow("Abigail");
		expect(abigail.portrait.style.backgroundImage).toBe(
			'url("/assets/portraits/Abigail.png")',
		);
		expect(abigail.portrait.style.backgroundSize).toMatch(/^200%/);
		abigail.cleanup();

		// The Dwarf's is a single frame
		stubPortraits(64);
		const dwarf = await renderRow("Dwarf");
		expect(dwarf.portrait.style.backgroundSize).toMatch(/^100%/);
		dwarf.cleanup();
	});

	it("keeps a villager's name from the save inside its portrait's url()", async () => {
		const requested = stubPortraits(128);
		const name = 'Lewis.png#"),url("https://attacker.example/b';
		const { portrait, cleanup } = await renderRow(name);

		// Encoded, so a quote in the name can't end the url("...") string early
		expect(portrait.getAttribute("style")).not.toContain(
			'url("https://attacker.example',
		);
		expect(requested).toEqual([
			`/assets/portraits/${encodeURIComponent(name)}.png`,
		]);
		cleanup();
	});
});
