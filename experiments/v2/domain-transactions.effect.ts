import { expect, it } from "@effect/vitest";
import { Effect, Exit, Fiber } from "effect";
import { readFile } from "node:fs/promises";
import { get } from "svelte/store";
import { makeHistorySession } from "./history.ts";
import { TransactionDraft } from "./transaction-draft.ts";
import {
	recordAnnotatedOperation,
	ReviewJournal,
	withReviewMetadata,
} from "./transaction-annotations.ts";
import { completeSpringForaging } from "./bundle-operations.ts";
import { setCalendarDate, setCalendarWeather } from "./calendar-operations.ts";
import { editorResources, openEditor } from "./editor-model.ts";
import { inventoryFixture } from "./inventory-model.ts";
import { parser, exportDocument } from "./fixture.ts";
import type { Save } from "../../codegen/save.ts";

const fixtureBytes = () =>
	readFile(new URL("../../tests/TestSave", import.meta.url));

it.effect(
	"captured transaction capabilities reject writes after their program finishes",
	() =>
		Effect.gen(function* () {
			const session = yield* makeHistorySession(inventoryFixture());
			const captured: {
				draft?: TransactionDraft["Service"];
				journal?: ReviewJournal["Service"];
			} = {};
			yield* session.transact(
				Effect.gen(function* () {
					captured.draft = yield* TransactionDraft;
					captured.journal = yield* ReviewJournal;
					yield* setMoney(8);
				}),
			);
			const before = yield* session.snapshot;
			if (!captured.draft || !captured.journal)
				throw new Error("Missing captured test capabilities");
			const lateRead = yield* Effect.exit(captured.draft.read);
			const lateRecord = yield* captured.journal
				.append({ label: "Too late" })
				.pipe(
					Effect.catchTag("ReviewMetadataError", () =>
						Effect.succeed("rejected"),
					),
				);
			expect(Exit.isFailure(lateRead)).toBe(true);
			expect(lateRecord).toBe("rejected");
			expect(yield* session.snapshot).toEqual(before);
		}),
);

it.effect("concurrent transaction retries publish each annotation once", () =>
	Effect.gen(function* () {
		const session = yield* makeHistorySession(inventoryFixture());
		const before = yield* session.snapshot;
		const increment = (label: string) =>
			recordAnnotatedOperation(
				Effect.gen(function* () {
					const draft = yield* TransactionDraft;
					const snapshot = yield* draft.read;
					// Let another transaction read the same revision, forcing retry/serialization
					// at the authoritative ref rather than relying on a lucky synchronous order.
					yield* Effect.yieldNow;
					snapshot.state.document.SaveGame.player.money++;
					yield* draft.replace(snapshot);
				}),
			).pipe(withReviewMetadata({ label }));
		yield* Effect.all(
			[session.transact(increment("One")), session.transact(increment("Two"))],
			{ concurrency: "unbounded" },
		);
		const after = yield* session.snapshot;
		expect(after.document.SaveGame.player.money).toBe(
			before.document.SaveGame.player.money + 2,
		);
		expect(after.entries).toHaveLength(2);
		expect(
			after.entries
				.flatMap((entry) => entry.annotations)
				.map((annotation) => annotation.label)
				.sort(),
		).toEqual(["One", "Two"]);
	}),
);

it.effect(
	"retained staging references and caller-owned tags cannot rewrite published state",
	() =>
		Effect.gen(function* () {
			const session = yield* makeHistorySession(inventoryFixture());
			const retained: { state?: import("./domain.ts").SessionState } = {};
			const tags = ["owned"];
			yield* session.transact(
				recordAnnotatedOperation(
					Effect.gen(function* () {
						const draft = yield* TransactionDraft;
						const snapshot = yield* draft.read;
						retained.state = snapshot.state;
						snapshot.state.document.SaveGame.player.money = 7;
						yield* draft.replace(snapshot);
					}),
				).pipe(withReviewMetadata({ tags })),
			);
			tags.push("late");
			if (retained.state) retained.state.document.SaveGame.player.money = 999;
			const after = yield* session.snapshot;
			expect(after.document.SaveGame.player.money).toBe(7);
			expect(after.entries[0].annotations[0].tags).toEqual(["owned"]);
		}),
);

it("bundle domain failures retain unsupported-data and late-mail tags", async () => {
	const document = parser.parse(new TextDecoder().decode(await fixtureBytes()));
	const game = document.SaveGame as unknown as Save;
	const definition = game.bundleData.item.find(
		(entry) => entry.key.string === "Crafts Room/13",
	);
	if (!definition) throw new Error("Missing fixture bundle definition");
	const vanilla = definition.value.string;
	definition.value.string = "modded";
	const unsupported = await openEditor(
		new TextEncoder().encode(exportDocument(document)),
	);
	try {
		await expect(
			unsupported.model.transact(completeSpringForaging()),
		).rejects.toMatchObject({ _tag: "BundleUnavailable" });
		expect(get(unsupported.model.view)?.entries).toEqual([]);
	} finally {
		await unsupported.close();
	}
	definition.value.string = vanilla;
	const cc = game.locations.GameLocation.find(
		(location) => location.name === "CommunityCenter",
	);
	if (!cc?.bundles) throw new Error("Missing fixture Community Center");
	for (const entry of cc.bundles.item)
		if ([14, 15, 16, 17, 19].includes(entry.key.int))
			entry.value.ArrayOfBoolean.boolean.fill(true);
	Object.assign(game.player, {
		mailReceived: { unsupported: "invalid mail container" },
	});
	const invalidMail = await openEditor(
		new TextEncoder().encode(exportDocument(document)),
	);
	try {
		const before = await invalidMail.model.snapshot();
		await expect(
			invalidMail.model.transact(completeSpringForaging()),
		).rejects.toMatchObject({ _tag: "BundleMailInvalid" });
		expect(await invalidMail.model.snapshot()).toEqual(before);
	} finally {
		await invalidMail.close();
	}
});

// This test-only feature is intentionally absent from Mutation. It proves that
// typed local functions and annotations can extend history without a central case.
const setMoney = (value: number) =>
	recordAnnotatedOperation(
		Effect.gen(function* () {
			const transaction = yield* TransactionDraft;
			const snapshot = yield* transaction.read;
			snapshot.state.document.SaveGame.player.money = value;
			yield* transaction.replace(snapshot);
		}),
	);

it.effect(
	"an independent domain program commits metadata and patches without extending Mutation",
	() =>
		Effect.gen(function* () {
			const session = yield* makeHistorySession(inventoryFixture());
			const before = yield* session.snapshot;
			const result = yield* session.transact(
				setMoney(99).pipe(
					withReviewMetadata({ label: "Gift money", tags: ["custom:gift"] }),
				),
			);
			expect(result.document.SaveGame.player.money).toBe(99);
			expect(result.entries[0].actions).toEqual([]);
			expect(result.entries[0].annotations).toEqual([
				{ label: "Gift money", tags: ["custom:gift"] },
			]);
			expect(result.entries[0].intent.label).toBe("Gift money");
			expect((yield* session.undo).document).toEqual(before.document);
			expect((yield* session.redo).entries[0].annotations).toEqual(
				result.entries[0].annotations,
			);
		}),
);

it.effect(
	"a failed or interrupted program preserves document, annotations, revision and redo",
	() =>
		Effect.gen(function* () {
			const session = yield* makeHistorySession(inventoryFixture());
			yield* session.transact(setMoney(25));
			yield* session.undo;
			const before = yield* session.snapshot;
			const failed = session.transact(
				Effect.gen(function* () {
					yield* setMoney(50);
					return yield* Effect.fail({
						_tag: "FeatureRejected" as const,
						reason: "test",
					});
				}),
			);
			const reason = yield* failed.pipe(
				Effect.catchTag("FeatureRejected", (failure) =>
					Effect.succeed(failure.reason),
				),
			);
			expect(reason).toBe("test");
			expect(yield* session.snapshot).toEqual(before);
			const fiber = yield* Effect.forkScoped(
				session.transact(
					Effect.gen(function* () {
						yield* setMoney(75);
						return yield* Effect.never;
					}),
				),
			);
			yield* Effect.yieldNow;
			yield* Fiber.interrupt(fiber);
			expect(yield* session.snapshot).toEqual(before);
		}),
);

it.effect(
	"stale revisions and sibling draft conflicts reject before losing a newer write",
	() =>
		Effect.gen(function* () {
			const session = yield* makeHistorySession(inventoryFixture());
			yield* session.transact(setMoney(1));
			const before = yield* session.snapshot;
			const stale = yield* Effect.exit(session.transact(setMoney(2), 0));
			expect(Exit.isFailure(stale)).toBe(true);
			const conflicting = yield* Effect.exit(
				session.transact(
					Effect.gen(function* () {
						const draft = yield* TransactionDraft;
						const first = yield* draft.read;
						const second = yield* draft.read;
						first.state.document.SaveGame.player.money = 3;
						yield* draft.replace(first);
						second.state.document.SaveGame.player.money = 4;
						yield* draft.replace(second);
					}),
				),
			);
			expect(Exit.isFailure(conflicting)).toBe(true);
			expect(yield* session.snapshot).toEqual(before);
		}),
);

it.effect(
	"annotation validation and byte budgets include metadata without partially applying the edit",
	() =>
		Effect.gen(function* () {
			const session = yield* makeHistorySession(inventoryFixture(), {
				bytes: 2000,
			});
			const before = yield* session.snapshot;
			const oversized = yield* Effect.exit(
				session.transact(
					setMoney(9).pipe(withReviewMetadata({ label: "x".repeat(4000) })),
				),
			);
			expect(Exit.isFailure(oversized)).toBe(true);
			const invalid = yield* session
				.transact(setMoney(9).pipe(withReviewMetadata({ label: undefined })))
				.pipe(
					Effect.catchTag("ReviewMetadataError", () =>
						Effect.succeed("rejected"),
					),
				);
			expect(invalid).toBe("rejected");
			expect(yield* session.snapshot).toEqual(before);
		}),
);

it.effect(
	"compact annotations stay inspectable, and baseline review survives eviction",
	() =>
		Effect.gen(function* () {
			const session = yield* makeHistorySession(inventoryFixture(), {
				entries: 1,
			});
			yield* session.transact(
				setMoney(5).pipe(
					withReviewMetadata({ label: "First", emphasis: "compact" }),
				),
			);
			const result = yield* session.transact(
				setMoney(6).pipe(
					withReviewMetadata({ label: "Second", emphasis: "compact" }),
				),
			);
			expect(result.dropped).toBe(1);
			expect(result.entries[0].intent.review).toBe("compact");
			expect((yield* session.review).net.map((patch) => patch.path)).toContain(
				"/SaveGame/player/money",
			);
			const noOp = yield* session.transact(setMoney(6));
			expect(noOp).toEqual(result);
		}),
);

it.effect(
	"unannotated writes remain visible and unsupported inventory identity writes fail atomically",
	() =>
		Effect.gen(function* () {
			const session = yield* makeHistorySession(inventoryFixture());
			const result = yield* session.transact(
				Effect.gen(function* () {
					const draft = yield* TransactionDraft;
					const snapshot = yield* draft.read;
					snapshot.state.document.SaveGame.player.money = 9;
					yield* draft.replace(snapshot);
				}),
			);
			expect(result.entries[0].intent).toMatchObject({
				label: "Unlabelled changes",
				review: "standalone",
			});
			const invalid = yield* Effect.exit(
				session.transact(
					Effect.gen(function* () {
						const draft = yield* TransactionDraft;
						const snapshot = yield* draft.read;
						snapshot.state.document.SaveGame.player.items.Item.reverse();
						yield* draft.replace(snapshot);
					}),
				),
			);
			expect(Exit.isFailure(invalid)).toBe(true);
			expect(yield* session.snapshot).toEqual(result);
		}),
);

it("calendar and bundle domain programs commit and export as one annotated group", async () => {
	const opened = await openEditor(await fixtureBytes());
	try {
		await opened.model.transact(
			Effect.gen(function* () {
				yield* setCalendarDate({ year: 3 });
				yield* completeSpringForaging();
			}).pipe(withReviewMetadata({ tags: ["group:prepare"] })),
		);
		const state = await opened.model.snapshot();
		expect(state.entries).toHaveLength(1);
		expect(state.entries[0].annotations).toHaveLength(2);
		expect(
			state.entries[0].annotations.every((record) =>
				record.tags?.includes("group:prepare"),
			),
		).toBe(true);
		expect(get(opened.model.view)?.bundle.completed).toBe(true);
		const exported = await opened.model.export();
		const reloaded = await openEditor(exported);
		try {
			expect(get(reloaded.model.view)?.calendar.date.year).toBe(3);
			expect(get(reloaded.model.view)?.bundle.completed).toBe(true);
			expect(get(reloaded.model.view)?.net).toEqual([]);
		} finally {
			await reloaded.close();
		}
		await opened.model.undo();
		expect(get(opened.model.view)?.bundle.completed).toBe(false);
		await opened.model.redo();
		const beforeNoOp = await opened.model.snapshot();
		await opened.model.transact(completeSpringForaging());
		expect(await opened.model.snapshot()).toEqual(beforeNoOp);
	} finally {
		await opened.close();
	}
	expect(editorResources()).toEqual({ models: 0, registries: 0, streams: 0 });
});

it("a typed calendar failure after staged bundle writes rolls back the entire group", async () => {
	const opened = await openEditor(await fixtureBytes());
	try {
		const before = await opened.model.snapshot();
		await expect(
			opened.model.transact(
				Effect.gen(function* () {
					yield* completeSpringForaging();
					yield* setCalendarWeather("today", "not-a-vanilla-weather");
				}),
			),
		).rejects.toMatchObject({ _tag: "CalendarRuleViolation" });
		expect(await opened.model.snapshot()).toEqual(before);
	} finally {
		await opened.close();
	}
});
