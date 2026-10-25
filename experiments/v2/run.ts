import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { Effect } from "effect";
import { makeEffectSession } from "./effect";
import { exportDocument, loadFixture, parser, scenarios } from "./fixture";
import { PlainSession } from "./plain";

const start = performance.now();
const document = await loadFixture();
const parseMs = performance.now() - start;
const rounds = 10;
const plainTimes: number[] = [];
const effectTimes: number[] = [];
for (let round = 0; round < rounds; round++) {
	// Alternate order to reduce systematic warm-up bias; still not a browser benchmark.
	for (const kind of round % 2 ? ["effect", "plain"] : ["plain", "effect"]) {
		const begin = performance.now();
		if (kind === "plain") {
			const session = new PlainSession(document);
			for (const action of scenarios(document)) session.execute(action);
			plainTimes.push(performance.now() - begin);
		} else {
			await Effect.runPromise(
				Effect.scoped(
					Effect.gen(function* () {
						const session = yield* makeEffectSession(document);
						for (const action of scenarios(document))
							yield* session.execute(action);
					}),
				),
			);
			effectTimes.push(performance.now() - begin);
		}
	}
}
const session = new PlainSession(document);
for (const action of scenarios(document)) session.execute(action);
const state = session.snapshot();
const exported = exportDocument(state.document);
assert.deepEqual(parser.parse(exported), state.document);
const median = (values: number[]) =>
	[...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
console.log(
	JSON.stringify(
		{
			node: process.version,
			rounds,
			parseMs,
			plainMs: {
				median: median(plainTimes),
				min: Math.min(...plainTimes),
				max: Math.max(...plainTimes),
			},
			effectMs: {
				median: median(effectTimes),
				min: Math.min(...effectTimes),
				max: Math.max(...effectTimes),
			},
			exportedBytes: Buffer.byteLength(exported),
			receipts: state.history.map(({ intent, label, review, changes }) => ({
				type: intent.type,
				label,
				review,
				changedPaths: changes.map((c) => c.path),
			})),
		},
		null,
		2,
	),
);
