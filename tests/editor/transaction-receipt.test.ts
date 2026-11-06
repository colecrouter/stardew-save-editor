import { Effect, Result } from "effect";
import { expect, it } from "vitest";
import { openEditor } from "../../src/lib/editor/editor-model.ts";
import { MutationError } from "../../src/lib/editor/domain.ts";
import { TransactionDraft } from "../../src/lib/editor/transaction-draft.ts";
import { fixtureXml, parser } from "./fixtures.ts";

// A receipt describes its own committed action, even if a queued Undo has already
// restored the document before its caller next reads the editor projection.
it(
	"returns the committed domain receipt and never exposes one from a rejected transaction",
	{ timeout: 25000 },
	async () => {
		const opened = await openEditor(new TextEncoder().encode(fixtureXml));
		try {
			const before = parser.parse(fixtureXml);
			const program = Effect.gen(function* () {
				const draft = yield* TransactionDraft;
				const snapshot = yield* draft.read;
				snapshot.state.document.SaveGame.player.money = 99;
				yield* draft.replace(snapshot);
				return { paid: 99 };
			});
			const committed = opened.model.commands.transact(program);
			const undo = opened.model.commands.undo();
			const result = await committed;
			expect(
				result && Result.isSuccess(result) ? result.success : undefined,
			).toEqual({ paid: 99 });
			await undo;
			expect(
				(await opened.model.snapshot()).document.SaveGame.player.money,
			).toBe(before.SaveGame.player.money);
			const rejected = await opened.model.commands.transact(
				Effect.gen(function* () {
					yield* program;
					return yield* new MutationError("Reject the prepared reward");
				}),
			);
			expect(
				rejected && Result.isFailure(rejected)
					? rejected.failure.message
					: undefined,
			).toBe("Reject the prepared reward");
			expect(
				(await opened.model.snapshot()).document.SaveGame.player.money,
			).toBe(before.SaveGame.player.money);
			const unauthorized = await opened.model.commands.transact(
				Effect.gen(function* () {
					const draft = yield* TransactionDraft;
					const snapshot = yield* draft.read;
					const first = snapshot.state.document.SaveGame.player.items.Item[0];
					if (!first) throw new Error("Missing fixture item");
					Object.assign(first, { stack: 999 });
					yield* draft.replace(snapshot);
					return { illegal: true };
				}),
			);
			expect(unauthorized && Result.isFailure(unauthorized)).toBe(true);
			expect(
				(await opened.model.snapshot()).document.SaveGame.player.items,
			).toEqual(before.SaveGame.player.items);
		} finally {
			await opened.close();
		}
	},
);
