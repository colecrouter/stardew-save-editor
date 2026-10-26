import { expect, it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import { planRainWatering } from "../../src/lib/calendarWatering.ts";
import {
	MutationError,
	type DomainState,
	type SessionState,
} from "./domain.ts";
import { exportDocument, tinyFixture } from "./fixture.ts";
import { makeHistorySession } from "./history.ts";
import {
	coreOperations,
	EditorOperations,
	type Operations,
} from "./operations.ts";

const money = (value: number) =>
	({ type: "money", farmerId: "host", value }) as const;
const ordinary: DomainState = { calendar: { today: "Sun", watering: [] } };
const rainy: DomainState = {
	calendar: {
		today: "Rain",
		watering: [{ id: "soil:1", context: "Default", kind: "soil", before: 0 }],
	},
};
const annotated: Operations = {
	prepare: (state, action) =>
		coreOperations.prepare(state, action).pipe(
			Effect.map((prepared) => ({
				...prepared,
				domainState: structuredClone(rainy),
			})),
		),
};

it.effect(
	"domain state rejects non-record roots, resources, cycles and non-finite values",
	() =>
		Effect.gen(function* () {
			const cyclic: { self?: unknown } = {};
			cyclic.self = cyclic;
			for (const invalid of [
				null,
				[],
				new Map(),
				cyclic,
				{ value: Number.NaN },
			]) {
				expect(
					Exit.isFailure(
						yield* Effect.exit(
							makeHistorySession(
								tinyFixture(),
								{},
								invalid as unknown as DomainState,
							),
						),
					),
				).toBe(true);
			}
		}),
);

it.effect(
	"document and operation-owned state undo and redo together without exporting metadata",
	() =>
		Effect.gen(function* () {
			const initial = structuredClone(ordinary);
			const baseline = tinyFixture();
			const session = yield* makeHistorySession(baseline, {}, initial);
			initial.calendar = { changedOutsideSession: true };
			expect((yield* session.snapshot).domainState).toEqual(ordinary);
			const after = yield* session.execute([money(50)]);
			expect(after.domainState).toEqual(rainy);
			expect(after.document.SaveGame.player.money).toBe(50);
			const undone = yield* session.undo;
			expect(undone.document).toEqual(baseline);
			expect(undone.domainState).toEqual(ordinary);
			const redone = yield* session.redo;
			expect(redone.document).toEqual(after.document);
			expect(redone.domainState).toEqual(rainy);
			expect(JSON.stringify((yield* session.review).net)).not.toContain(
				"watering",
			);
			const xml = exportDocument(after.document);
			expect(xml).not.toContain("<domainState>");
			expect(xml).not.toContain("soil:1");
			expect(after.retainedBytes).toBe(
				new TextEncoder().encode(JSON.stringify(after.entries[0])).byteLength,
			);
		}).pipe(Effect.provideService(EditorOperations, annotated)),
);

it.effect(
	"domain-only operations retain their intent and invalidate stale drafts across undo",
	() => {
		const adapter: Operations = {
			prepare: (state, action) =>
				Effect.succeed({
					...state,
					domainState: structuredClone(rainy),
					history: [
						...state.history,
						{
							intent: action,
							label: "Remember ordinary weather",
							review: "compact",
							changes: [],
						},
					],
				}),
		};
		return Effect.gen(function* () {
			const session = yield* makeHistorySession(tinyFixture(), {}, ordinary);
			const before = yield* session.snapshot;
			const after = yield* session.execute([money(10)]);
			expect(after.entries).toHaveLength(1);
			expect(after.entries[0].forward).toEqual([]);
			expect(after.entries[0].intent.label).toBe("Remember ordinary weather");
			expect((yield* session.review).net).toEqual([]);
			expect((yield* session.undo).domainState).toEqual(ordinary);
			expect(
				Exit.isFailure(
					yield* Effect.exit(
						session.execute([money(30)], undefined, before.revision),
					),
				),
			).toBe(true);
			expect((yield* session.redo).domainState).toEqual(rainy);
		}).pipe(Effect.provideService(EditorOperations, adapter));
	},
);

it.effect(
	"in-place adapter writes cannot escape a failed compound operation",
	() => {
		const adapter: Operations = {
			prepare: (state, action) =>
				Effect.suspend(() => {
					state.document.SaveGame.player.money = 999;
					state.domainState = structuredClone(rainy);
					return action.type === "farm-name"
						? Effect.fail(new MutationError("Rejected after staging writes"))
						: Effect.succeed(state);
				}),
		};
		return Effect.gen(function* () {
			const session = yield* makeHistorySession(tinyFixture(), {}, ordinary);
			const before = yield* session.snapshot;
			const result = yield* Effect.exit(
				session.execute([money(50), { type: "farm-name", value: "Rejected" }]),
			);
			expect(Exit.isFailure(result)).toBe(true);
			expect(yield* session.snapshot).toEqual(before);
		}).pipe(Effect.provideService(EditorOperations, adapter));
	},
);

it.effect(
	"published state is detached from drafts retained by adapters and snapshot consumers",
	() => {
		let retained: SessionState | undefined;
		const adapter: Operations = {
			prepare: (state, action) =>
				annotated.prepare(state, action).pipe(
					Effect.map((prepared) => {
						retained = prepared;
						return prepared;
					}),
				),
		};
		return Effect.gen(function* () {
			const session = yield* makeHistorySession(tinyFixture(), {}, ordinary);
			const after = yield* session.execute([money(50)]);
			if (!retained) throw new Error("No adapter draft");
			retained.document.SaveGame.player.money = 777;
			if (!retained.domainState) throw new Error("No retained domain state");
			retained.domainState.calendar = { external: true };
			after.domainState.calendar = { external: true };
			const current = yield* session.snapshot;
			expect(current.document.SaveGame.player.money).toBe(50);
			expect(current.domainState).toEqual(rainy);
			expect(current.entries[0].domainAfter).toEqual(rainy);
		}).pipe(Effect.provideService(EditorOperations, adapter));
	},
);

it.effect(
	"legacy adapters that omit domain state preserve the current value",
	() => {
		const adapter: Operations = {
			prepare: (state, action) =>
				coreOperations
					.prepare(state, action)
					.pipe(Effect.map(({ document, history }) => ({ document, history }))),
		};
		return Effect.gen(function* () {
			const session = yield* makeHistorySession(tinyFixture(), {}, ordinary);
			expect((yield* session.execute([money(50)])).domainState).toEqual(
				ordinary,
			);
		}).pipe(Effect.provideService(EditorOperations, adapter));
	},
);

it.effect(
	"invalid initial or prepared metadata is rejected without normalization or publication",
	() => {
		const invalid = { removedByStringify: undefined } as unknown as DomainState;
		const adapter: Operations = {
			prepare: (state, action) =>
				coreOperations
					.prepare(state, action)
					.pipe(
						Effect.map((prepared) => ({ ...prepared, domainState: invalid })),
					),
		};
		return Effect.gen(function* () {
			expect(
				Exit.isFailure(
					yield* Effect.exit(makeHistorySession(tinyFixture(), {}, invalid)),
				),
			).toBe(true);
			const session = yield* makeHistorySession(tinyFixture(), {}, ordinary);
			const before = yield* session.snapshot;
			expect(
				Exit.isFailure(yield* Effect.exit(session.execute([money(50)]))),
			).toBe(true);
			expect(yield* session.snapshot).toEqual(before);
		}).pipe(Effect.provideService(EditorOperations, adapter));
	},
);

it.effect(
	"oversized domain state preserves redo, identities and the published document",
	() => {
		const adapter: Operations = {
			prepare: (state, action) =>
				coreOperations.prepare(state, action).pipe(
					Effect.map((prepared) => ({
						...prepared,
						domainState: {
							metadata:
								action.type === "money" && action.value === 99
									? "x".repeat(10_000)
									: "small",
						},
					})),
				),
		};
		return Effect.gen(function* () {
			const reference = yield* makeHistorySession(tinyFixture());
			const first = yield* reference.execute([money(20)]);
			const session = yield* makeHistorySession(tinyFixture(), {
				bytes: first.retainedBytes + 100,
			});
			yield* session.execute([money(20)]);
			yield* session.undo;
			const before = yield* session.snapshot;
			expect(
				Exit.isFailure(yield* Effect.exit(session.execute([money(99)]))),
			).toBe(true);
			expect(yield* session.snapshot).toEqual(before);
			expect((yield* session.redo).domainState).toEqual({ metadata: "small" });
		}).pipe(Effect.provideService(EditorOperations, adapter));
	},
);

it.effect(
	"production watering provenance is valid history state without stringify normalization",
	() =>
		Effect.gen(function* () {
			const prepared = planRainWatering({
				targets: [
					{
						id: "soil:missing",
						kind: "soil",
						value: undefined,
						context: "Default",
						outdoors: true,
					},
				],
				provenance: [],
				context: "Default",
				wasRaining: false,
				raining: true,
			});
			const session = yield* makeHistorySession(
				tinyFixture(),
				{},
				{ watering: prepared.provenance },
			);
			expect((yield* session.snapshot).domainState).toEqual({
				watering: [{ id: "soil:missing", context: "Default", kind: "soil" }],
			});
		}),
);

it.effect(
	"an outer transaction rolls back document and domain state across successful history updates",
	() =>
		Effect.gen(function* () {
			const session = yield* makeHistorySession(tinyFixture(), {}, ordinary);
			const before = yield* session.snapshot;
			const result = yield* Effect.exit(
				Effect.tx(
					Effect.gen(function* () {
						yield* session.execute([money(50)]);
						yield* session.execute([money(60)]);
						return yield* Effect.fail(
							new MutationError("Reject enclosing operation"),
						);
					}),
				),
			);
			expect(Exit.isFailure(result)).toBe(true);
			expect(yield* session.snapshot).toEqual(before);
		}).pipe(Effect.provideService(EditorOperations, annotated)),
);

it.effect(
	"prototype-looking metadata keys remain data through domain-only undo and redo",
	() => {
		const metadata = JSON.parse(
			'{"__proto__":{"retained":true}}',
		) as DomainState;
		const adapter: Operations = {
			prepare: (state) => Effect.succeed({ ...state, domainState: metadata }),
		};
		return Effect.gen(function* () {
			const session = yield* makeHistorySession(tinyFixture());
			const after = yield* session.execute([money(10)]);
			expect(after.entries).toHaveLength(1);
			expect(Object.hasOwn(after.domainState, "__proto__")).toBe(true);
			expect(Object.hasOwn(Object.prototype, "retained")).toBe(false);
			expect((yield* session.undo).domainState).toEqual({});
			expect((yield* session.redo).domainState).toEqual(metadata);
		}).pipe(Effect.provideService(EditorOperations, adapter));
	},
);
