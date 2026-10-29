import { describe, expect, it } from "vitest";
import { Result } from "effect";
import { openEditor } from "../../src/lib/editor/editor-model.ts";
import { createCharacterDomain } from "../../src/lib/editor/character-domain.ts";
import { createFarmFields } from "../../src/lib/editor/farm-domain.ts";
import { readCharacters } from "../../src/lib/editor/character-operations.ts";
import { readFarmSettings } from "../../src/lib/editor/farm-operations.ts";
import { exportDocument, fixtureXml, parser } from "./fixtures.ts";

function required<T>(value: T | undefined): T {
	if (value === undefined) throw new Error("Expected fixture value");
	return value;
}

// Exercise domain field adapters against a real file session: controls receive
// ordinary fields while those fields own coordinated game writes and grouping.
describe("domain-owned field adapters", { timeout: 25000 }, () => {
	it("groups repeated skill edits and restores the original full save with one Undo", async () => {
		const opened = await openEditor(new TextEncoder().encode(fixtureXml));
		try {
			const before = await opened.model.snapshot();
			const character = createCharacterDomain(
				required(readCharacters(before.document)[0]),
				opened.model,
			);
			const farming = required(
				character.skills.find((skill) => skill.key === "farming"),
			);
			const field = farming.fields.xp;
			const gesture = field.begin();
			const first = await field.commit(380, gesture);
			const second = await field.commit(770, gesture);
			expect(first && Result.isSuccess(first)).toBe(true);
			expect(second && Result.isSuccess(second)).toBe(true);
			await field.end(gesture);
			const after = await opened.model.snapshot();
			expect(after.entries).toHaveLength(1);
			expect(after.document.SaveGame.player).toMatchObject({
				experiencePoints: { int: expect.arrayContaining([770]) },
				farmingLevel: 3,
			});
			await opened.model.commands.undo();
			expect((await opened.model.snapshot()).document).toEqual(before.document);
			await opened.model.commands.redo();
			expect((await opened.model.snapshot()).document).toEqual(after.document);
		} finally {
			await opened.close();
		}
	});

	it("keeps an existing field bound to its farmer after the shared selection changes", async () => {
		const document = parser.parse(fixtureXml);
		const guest = structuredClone(document.SaveGame.player);
		guest.UniqueMultiplayerID = "guest";
		guest.name = "Guest";
		document.SaveGame.farmhands = { Farmer: [guest] };
		const opened = await openEditor(
			new TextEncoder().encode(exportDocument(document)),
		);
		try {
			const before = await opened.model.snapshot();
			const host = createCharacterDomain(
				required(readCharacters(before.document)[0]),
				opened.model,
			);
			const field = required(
				host.skills.find((skill) => skill.key === "farming"),
			).fields.xp;
			await opened.model.commands.selectFarmer("guest");
			const gesture = field.begin();
			await field.commit(10000, gesture);
			await field.end(gesture);
			const after = (await opened.model.snapshot()).document;
			expect(after.SaveGame.player).toMatchObject({ farmingLevel: 9 });
			expect(after.SaveGame.farmhands).toEqual(
				before.document.SaveGame.farmhands,
			);
		} finally {
			await opened.close();
		}
	});

	it("groups farm text changes and removes the net Undo entry when the original value returns", async () => {
		const opened = await openEditor(new TextEncoder().encode(fixtureXml));
		try {
			const before = await opened.model.snapshot();
			const field = createFarmFields(
				readFarmSettings(before.document),
				opened.model,
			).name;
			expect(field.constraints?.required).toBe(true);
			const gesture = field.begin();
			await field.commit("R", gesture);
			await field.commit("River", gesture);
			expect((await opened.model.snapshot()).entries).toHaveLength(1);
			await field.commit(required(field.value), gesture);
			await field.end(gesture);
			const after = await opened.model.snapshot();
			expect(after.entries).toHaveLength(0);
			expect(after.document).toEqual(before.document);
		} finally {
			await opened.close();
		}
	});
});
