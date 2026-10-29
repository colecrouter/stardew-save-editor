import { ItemData } from "../../src/lib/ItemData.ts";
import { Sprite } from "../../src/lib/Sprite.svelte.ts";
import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { tinyFixture } from "./fixtures.ts";
import { makeHistorySession } from "../../src/lib/editor/history.ts";
import {
	readAppearances,
	setAppearance,
	type AppearanceChange,
} from "../../src/lib/editor/appearance-operations.ts";
import { appearanceLayers } from "../../src/lib/editor/appearance-preview.ts";
import { packRgba } from "../../src/lib/color.ts";
function fixture() {
	const document = tinyFixture();
	Object.assign(document.SaveGame.player, {
		gender: "Female",
		Gender: "Female",
		skin: 2,
		hair: 100,
		accessory: -1,
		favoriteThing: "Stars",
		hairstyleColor: {
			R: 10,
			G: 20,
			B: 30,
			A: 120,
			PackedValue: packRgba(10, 20, 30, 120),
			opaque: "keep",
		},
		newEyeColor: {
			R: 1,
			G: 2,
			B: 3,
			A: 255,
			PackedValue: packRgba(1, 2, 3, 255),
		},
		shirtItem: { "@_xsi:nil": "true" },
		pantsItem: { "@_xsi:nil": "true" },
	});
	return document;
}
const run = <A, E>(effect: Effect.Effect<A, E, import("effect").Scope.Scope>) =>
	Effect.runPromise(Effect.scoped(effect));
describe("appearance operations", () => {
	it("projects sheet-two hair and preview without changing save data", () => {
		const document = fixture(),
			before = structuredClone(document);
		const view = readAppearances(document)[0];
		expect(view?.numbers.find((field) => field.key === "hair")?.value).toBe(56);
		expect(
			view?.preview.layers.some(
				(layer) =>
					layer.part === "hair" && layer.sheet.endsWith("hairstyles2.png"),
			),
		).toBe(true);
		expect(view?.preview.layers.some((layer) => layer.part === "shirt")).toBe(
			true,
		);
		expect(document).toEqual(before);
	});
	it("projects plain drawing instructions without exposing saved appearance records", () => {
		const document = fixture();
		const savedColor = { R: 10, G: 20, B: 30, A: 120 };
		Object.assign(document.SaveGame.player, { hairstyleColor: savedColor });
		const preview = readAppearances(document)[0]?.preview;
		if (!preview) throw new Error("Missing appearance preview");
		const before = structuredClone(preview);
		// A domain view owns its drawing instructions. Changing an imported color
		// afterwards cannot alter the already projected tint or reveal equipment DTOs.
		savedColor.R = 250;
		expect(preview).toEqual(before);
		expect(preview.layers.find((layer) => layer.part === "hair")?.tint).toEqual(
			[10, 20, 30, 120],
		);
		expect(Object.keys(preview).sort()).toEqual(["gender", "layers", "notice"]);
	});
	it("keeps unknown equipment read-only and gives a preview notice", () => {
		const document = fixture();
		Object.assign(document.SaveGame.player, {
			shirtItem: {
				"@_xsi:type": "Clothing",
				itemId: { opaque: "keep" },
				name: "Unknown shirt",
			},
		});
		const before = structuredClone(document),
			view = readAppearances(document)[0];
		expect(view?.preview.notice).toMatch(/imported equipment/);
		expect(document).toEqual(before);
	});
	it("allows an explicitly empty favorite thing", () =>
		run(
			Effect.gen(function* () {
				const session = yield* makeHistorySession(fixture());
				yield* session.transact(
					setAppearance({ farmerId: "host", kind: "favorite", value: "" }),
				);
				expect(
					readAppearances((yield* session.snapshot).document)[0]?.texts.favorite
						.value,
				).toBe("");
			}),
		));
	it("coordinates gender mirrors and hair representation with exact Undo/Redo", () =>
		run(
			Effect.gen(function* () {
				const document = fixture(),
					before = structuredClone(document),
					session = yield* makeHistorySession(document);
				yield* session.transact(
					Effect.gen(function* () {
						yield* setAppearance({
							farmerId: "host",
							kind: "gender",
							value: "Male",
						});
						yield* setAppearance({ farmerId: "host", kind: "hair", value: 73 });
					}),
				);
				const after = yield* session.snapshot;
				expect(after.document.SaveGame.player).toMatchObject({
					gender: "Male",
					Gender: "Male",
					hair: 117,
				});
				expect(after.entries).toHaveLength(1);
				yield* session.undo;
				expect((yield* session.snapshot).document).toEqual(before);
				yield* session.redo;
				expect((yield* session.snapshot).document).toEqual(after.document);
			}),
		));
	it("preserves alpha, opaque color members and unrelated equipment", () =>
		run(
			Effect.gen(function* () {
				const document = fixture(),
					before = structuredClone(document),
					session = yield* makeHistorySession(document);
				yield* session.transact(
					setAppearance({
						farmerId: "host",
						kind: "hair-color",
						value: "#ff0080",
					}),
				);
				expect(
					(yield* session.snapshot).document.SaveGame.player,
				).toMatchObject({
					hairstyleColor: {
						R: 255,
						G: 0,
						B: 128,
						A: 120,
						opaque: "keep",
						PackedValue: packRgba(255, 0, 128, 120),
					},
				});
				expect(
					(yield* session.snapshot).document.SaveGame.player.items,
				).toEqual(before.SaveGame.player.items);
			}),
		));
	it("rejects invalid and inherited requests without publication", () =>
		run(
			Effect.gen(function* () {
				const document = fixture(),
					session = yield* makeHistorySession(document);
				// Runtime boundaries receive unknown JavaScript inputs despite typed callers.
				const requests: unknown[] = [
					{ farmerId: "host", kind: "gender", value: "bad" },
					{ farmerId: "host", kind: "hair", value: 74 },
					{ farmerId: "host", kind: "skin", value: NaN },
					{ farmerId: "host", kind: "name", value: "" },
					Object.create({ farmerId: "host", kind: "name", value: "Other" }),
				];
				for (const request of requests) {
					const outcome = yield* Effect.result(
						session.transact(setAppearance(request as AppearanceChange)),
					);
					expect(outcome._tag).toBe("Failure");
				}
				expect((yield* session.snapshot).document).toEqual(document);
				expect((yield* session.snapshot).entries).toHaveLength(0);
			}),
		));
	it("keeps malformed values independently read-only and custom imported indices preserved", () =>
		run(
			Effect.gen(function* () {
				const document = fixture();
				Object.assign(document.SaveGame.player, {
					skin: 99,
					hair: 300,
					newEyeColor: { R: "bad", G: 1, B: 2, A: 255 },
				});
				const view = readAppearances(document)[0];
				expect(view?.numbers.find((field) => field.key === "skin")?.value).toBe(
					99,
				);
				expect(
					view?.colors.find((field) => field.key === "eye-color")?.available,
				).toBe(false);
				const session = yield* makeHistorySession(document);
				yield* session.transact(
					setAppearance({ farmerId: "host", kind: "favorite", value: "Moon" }),
				);
				expect(
					(yield* session.snapshot).document.SaveGame.player,
				).toMatchObject({
					skin: 99,
					hair: 300,
					newEyeColor: { R: "bad", G: 1, B: 2, A: 255 },
				});
				const failure = yield* Effect.result(
					session.transact(
						setAppearance({
							farmerId: "host",
							kind: "eye-color",
							value: "#ffffff",
						}),
					),
				);
				expect(failure._tag).toBe("Failure");
			}),
		));
	it("captures the requested farmer and rejects ambiguous identities", () =>
		run(
			Effect.gen(function* () {
				const document = fixture(),
					guest =
						document.SaveGame.farmhands &&
						document.SaveGame.farmhands.Farmer[0];
				if (!guest) throw new Error("Missing guest");
				Object.assign(guest, { favoriteThing: "Guest favorite" });
				const session = yield* makeHistorySession(document);
				yield* session.transact(
					setAppearance({ farmerId: "guest", kind: "favorite", value: "Rain" }),
				);
				expect(
					(yield* session.snapshot).document.SaveGame.player,
				).toMatchObject({ favoriteThing: "Stars" });
				expect(
					readAppearances((yield* session.snapshot).document).find(
						(view) => view.farmerId === "guest",
					)?.texts.favorite.value,
				).toBe("Rain");
				guest.UniqueMultiplayerID = "host";
				const ambiguous = yield* makeHistorySession(document);
				const result = yield* Effect.result(
					ambiguous.transact(
						setAppearance({ farmerId: "host", kind: "name", value: "Changed" }),
					),
				);
				expect(result._tag).toBe("Failure");
			}),
		));
});

// The game draws a complete standing frame from each 192×688 pants block;
// inventory icons live below the animation and must never replace the legs.
it("previews standing pants frames for both body types instead of inventory icons", () => {
	const info = ItemData.get("Polka Dot Shorts");
	if (!info) throw new Error("Missing preview pants");
	const sprite = new Sprite(info);
	for (const [gender, column] of [
		["Male", 0],
		["Female", 96],
	] as const) {
		const pants = appearanceLayers({
			gender,
			skin: 0,
			hair: 0,
			accessory: -1,
		}).layers.find((layer) => layer.part === "pants");
		if (!pants) throw new Error("Missing pants layer");
		expect((sprite.sheetSize.height - pants.y) % 688).toBe(0);
		expect((sprite.sheetSize.width - pants.x) % 192).toBe(column);
	}
});
