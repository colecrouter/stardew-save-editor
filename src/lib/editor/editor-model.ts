import type { BackpackMoveRequest } from "./backpack-movement.ts";
import type { BackpackLifecycleRequest } from "./backpack-lifecycle.ts";
import {
	readBackpacks,
	type BackpackView,
	type BackpackItemEdits,
} from "./inventory-operations.ts";
import { readFarmSettings, type FarmView } from "./farm-operations.ts";
import {
	validateSave,
	describeProblems,
	type SaveValidation,
} from "../saveValidation.ts";
import type { CommandResult } from "./command-result.ts";
import type { TransactionDraft } from "./transaction-draft.ts";
import type { ReviewJournal } from "./transaction-annotations.ts";
import { setCalendarDate } from "./calendar-operations.ts";
import { springBundleView } from "./bundle-operations.ts";
import {
	Cause,
	Data,
	Effect,
	Exit,
	Fiber,
	JsonPatch,
	Result,
	Scope,
	Stream,
} from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { derived, type Readable } from "svelte/store";
import type { Save } from "../../../codegen/save.ts";
import {
	forcedWeather,
	greenRainDay,
	MAX_YEAR,
	nextDay,
	SEASONS,
	seasonWeathers,
	weatherLabel,
	type GameDate,
} from "../calendar.ts";
import {
	readCalendarView,
	type CalendarViewState,
} from "../calendarDocument.ts";
import type { Field } from "./field.ts";
import type { Mutation } from "./domain.ts";
import { makeHistorySession, type HistoryLimits } from "./history.ts";
import type { HistorySession, HistoryState } from "./history.ts";
import { SaveCodec, SaveCodecLive } from "./save-service.ts";

export class SaveExportRejected extends Data.TaggedError("SaveExportRejected")<{
	readonly message: string;
	readonly validation: SaveValidation;
}> {}

const resources = { models: 0, registries: 0, streams: 0 };
export const editorResources = () => ({ ...resources });
export interface WeatherChoice {
	id: string;
	label: string;
	allowed: boolean;
}
export interface EditorView {
	revision: number;
	bundle: ReturnType<typeof springBundleView>;
	calendar: CalendarViewState;
	farm: FarmView;
	backpacks: BackpackView[];
	greenRain: number;
	todayOptions: WeatherChoice[];
	tomorrowOptions: WeatherChoice[];
	todayReason?: string;
	tomorrowReason?: string;
	canUndo: boolean;
	canRedo: boolean;
	retainedBytes: number;
	dropped: number;
	entries: {
		id: number;
		label: string;
		compact: boolean;
		applied: boolean;
		paths: string[];
		annotations: HistoryState["entries"][number]["annotations"];
	}[];
	net: JsonPatch.JsonPatch;
	farmerId: string;
	backpackSize: number;
}

// Build the feature projection from committed state only. Form drafts never
// enter this function, and projection must not normalize the imported document.
function project(state: HistoryState, includeProofs = false): EditorView {
	const game = state.document.SaveGame as unknown as Save;
	if (!Number.isFinite(game.year) || !Number.isFinite(game.dayOfMonth))
		throw new Error("The save has no readable calendar date.");
	const calendar = readCalendarView(game);
	const day = greenRainDay(
		calendar.date.year,
		Number(game.uniqueIDForThisGame),
		game.useLegacyRandom === true,
	);
	// Weather constraints belong to the date being edited: tomorrow can cross a
	// season or year boundary. Keep an unknown imported choice visible rather than
	// silently replacing it with the first vanilla option.
	const options = (tomorrow: boolean) => {
		const date = tomorrow ? nextDay(calendar.date) : calendar.date;
		const fixed = forcedWeather(
			date,
			calendar.daysPlayed + (tomorrow ? 1 : 0),
			greenRainDay(
				date.year,
				Number(game.uniqueIDForThisGame),
				game.useLegacyRandom === true,
			),
		);
		const current = tomorrow ? calendar.tomorrow : calendar.today;
		const ids = new Set<string>([
			current,
			...seasonWeathers(date.season),
			...(fixed ? [fixed.weather] : []),
		]);
		return {
			reason: fixed?.reason,
			values: [...ids].map((id) => ({
				id,
				label: weatherLabel(id),
				allowed: fixed
					? id === fixed.weather
					: seasonWeathers(date.season).includes(id as never) || id === current,
			})),
		};
	};
	const today = options(false),
		tomorrow = options(true);
	return {
		revision: state.revision,
		bundle: includeProofs
			? springBundleView(state.document)
			: {
					supported: false,
					completed: false,
					rewardAvailable: false,
					reason: "",
				},
		calendar,
		farm: readFarmSettings(state.document),
		backpacks: readBackpacks(state),
		greenRain: day,
		todayOptions: today.values,
		tomorrowOptions: tomorrow.values,
		todayReason: today.reason,
		tomorrowReason: tomorrow.reason,
		canUndo: state.cursor > 0,
		canRedo: state.cursor < state.entries.length,
		retainedBytes: state.retainedBytes,
		dropped: state.dropped,
		entries: state.entries.map((entry, index) => ({
			id: entry.id,
			label: entry.intent.label || "Unlabelled changes",
			compact: entry.intent.review === "compact",
			applied: index < state.cursor,
			paths: entry.forward.map((patch) => patch.path),
			annotations: entry.annotations,
		})),
		// Baseline comparison survives undo-history eviction and exposes actual
		// document writes even if an operation supplied an incomplete receipt.
		net: JsonPatch.get(state.baseline as never, state.document as never),
		farmerId: String(game.player.UniqueMultiplayerID),
		backpackSize: includeProofs ? game.player.items.Item.length : 0,
	};
}

// Draft fields intentionally retain strings, including blank/invalid input. Only
// submission converts them to a complete validated game date.
export function parseDateDraft(text: string): GameDate {
	const input: unknown = JSON.parse(text);
	if (!input || typeof input !== "object")
		throw new Error("Enter a valid date.");
	const raw = input as Record<string, unknown>;
	const integer = (value: unknown) =>
		typeof value === "string" && /^\d+$/.test(value)
			? Number(value)
			: Number.NaN;
	const date = {
		year: integer(raw.year),
		day: integer(raw.day),
		season: raw.season,
	} as GameDate;
	if (
		!Number.isSafeInteger(date.year) ||
		date.year < 1 ||
		date.year > MAX_YEAR ||
		!Number.isInteger(date.day) ||
		date.day < 1 ||
		date.day > 28 ||
		!SEASONS.includes(date.season)
	)
		throw new Error(`Choose Year 1–${MAX_YEAR}, a season, and Day 1–28.`);
	return date;
}
export const formatDateDraft = (date: GameDate) =>
	JSON.stringify({
		year: String(date.year),
		season: date.season,
		day: String(date.day),
	});

// Only projected values enter Atom. No full save document or writable atom is
// exported to views. Closing the scope clears both the engine and registry.
export const makeEditorModel = (
	session: HistorySession,
	codec: SaveCodec["Service"],
	options: { includeProofs?: boolean; validateExport?: boolean } = {},
) =>
	Effect.gen(function* () {
		// Capture the session scope and services once at the application boundary.
		// UI promises run child fibers here so closing the file interrupts owned work.
		const scope = yield* Effect.scope;
		const context = yield* Effect.context<Scope.Scope>();
		const runWithContext = Effect.runPromiseWith(context);
		const runExitWithContext = Effect.runPromiseExitWith(context);
		// Retained UI handles must become inert after close and release their engine
		// reference; rejecting later commands alone would still retain the save.
		let engine: HistorySession | undefined = session;
		let closed = false;
		yield* Effect.acquireRelease(
			Effect.sync(() => {
				resources.models++;
			}),
			() =>
				Effect.sync(() => {
					closed = true;
					engine = undefined;
					resources.models--;
				}),
		);
		let registry: AtomRegistry.AtomRegistry | undefined =
			yield* Effect.acquireRelease(
				Effect.sync(() => {
					resources.registries++;
					return AtomRegistry.make({ defaultIdleTTL: 0, timeoutResolution: 1 });
				}),
				(value) =>
					Effect.sync(() => {
						value.set(viewAtom, undefined);
						value.dispose();
						registry = undefined;
						resources.registries--;
					}),
			);
		// Keep projections while panels have no consumers. Registry disposal, rather
		// than temporary unmounting, defines their lifetime within this session.
		const viewAtom = Atom.make<EditorView | undefined>(undefined).pipe(
			Atom.keepAlive,
		);
		const pendingAtom = Atom.make(0).pipe(Atom.keepAlive);
		// Notifications belong to the session boundary, not individual features.
		// Store only a generic message; no document or operation payload is logged.
		const noticeAtom = Atom.make<{ id: number; message: string } | undefined>(
			undefined,
		).pipe(Atom.keepAlive);
		let noticeId = 0;
		// Serialize commands and export together: an export requested after Apply
		// must include that commit. A rejected command must not poison later work.
		let queue: Promise<void> = Promise.resolve();
		const command = <A>(work: () => Promise<A>): Promise<A> => {
			if (closed)
				return Promise.reject(new Error("This save session is closed."));
			if (registry) registry.set(pendingAtom, registry.get(pendingAtom) + 1);
			const result = queue.then(work);
			queue = result.then(
				() => {},
				() => {},
			);
			return result.finally(() => {
				if (registry) registry.set(pendingAtom, registry.get(pendingAtom) - 1);
			});
		};
		// Both the command result and subscription stream can deliver a revision.
		// Ignore duplicates and late older deliveries to avoid regression/reprojection.
		const publish = (state: HistoryState) => {
			if (
				!closed &&
				registry &&
				state.revision > (registry.get(viewAtom)?.revision ?? -1)
			)
				registry.set(viewAtom, project(state, options.includeProofs));
		};
		const imported = yield* session.snapshot;
		const loadValidation = validateSave(imported.document);
		publish(imported);
		// Own the observer fiber with the file, not with an individual screen. Panel
		// navigation should neither fork additional streams nor lose committed state.
		const stream = Stream.unwrap(
			Effect.gen(function* () {
				yield* Effect.acquireRelease(
					Effect.sync(() => {
						resources.streams++;
					}),
					() =>
						Effect.sync(() => {
							resources.streams--;
						}),
				);
				return session.changes;
			}),
		);
		yield* Effect.forkScoped(
			Stream.runForEach(stream, (state) => Effect.sync(() => publish(state))),
		);
		const view: Readable<EditorView | undefined> = {
			subscribe: (notify) => {
				if (!registry) {
					notify(undefined);
					return () => {};
				}
				return registry.subscribe(viewAtom, notify, { immediate: true });
			},
		};
		const live = () => {
			if (closed || !engine) throw new Error("This save session is closed.");
			return engine;
		};
		const run = <A, E>(effect: Effect.Effect<A, E>) =>
			runWithContext(
				Effect.gen(function* () {
					const fiber = yield* Effect.forkScoped(effect);
					return yield* Fiber.join(fiber);
				}).pipe(Effect.provideService(Scope.Scope, scope)),
			);
		const execute = async (
			actions: readonly Mutation[],
			expectedRevision?: number,
		) => {
			await command(async () => {
				const result = await run(
					live().execute(actions, undefined, expectedRevision),
				);
				publish(result);
			});
		};
		// Domain programs carry their inferred errors and ambient metadata into the
		// same command queue. This boundary does not enumerate feature actions or
		// erase their tagged failures into a framework-wide error union.
		const transact = <E>(
			program: Effect.Effect<
				unknown,
				E,
				TransactionDraft | ReviewJournal | BackpackItemEdits
			>,
			expectedRevision?: number,
		) =>
			command(async () => {
				publish(await run(live().transact(program, expectedRevision)));
			});
		// Execute inside the file scope and queue, preserving the full Exit until
		// the boundary distinguishes expected failures, cancellation and defects.
		const submit = <A, E>(
			work: () => Effect.Effect<A, E>,
		): Promise<CommandResult<A, E>> => {
			if (closed) return Promise.resolve(null);
			return command(async () => {
				if (closed) return null;
				const exit = await runExitWithContext(
					Effect.gen(function* () {
						const fiber = yield* Effect.forkScoped(Effect.suspend(work));
						return yield* Fiber.join(fiber);
					}).pipe(Effect.provideService(Scope.Scope, scope)),
				);
				if (Exit.isSuccess(exit)) return Result.succeed(exit.value);
				// A mixed failure/defect must not be reduced to its first typed error.
				if (!Cause.hasDies(exit.cause) && !Cause.hasInterrupts(exit.cause)) {
					const failure = Cause.findError(exit.cause);
					if (Result.isSuccess(failure)) return Result.fail(failure.success);
				}
				if (!Cause.hasInterruptsOnly(exit.cause)) {
					console.error("V2 command defect", Cause.pretty(exit.cause));
					if (!closed && registry)
						registry.set(noticeAtom, {
							id: ++noticeId,
							message: "The action couldn’t be completed. Please try again.",
						});
				}
				return null;
			});
		};
		const publishEffect = <E>(effect: Effect.Effect<HistoryState, E>) =>
			Effect.flatMap(effect, (state) =>
				Effect.sync(() => {
					publish(state);
				}),
			);
		const commands = {
			/** Move or swap across actual backpack slots and return the moved instance. */
			moveBackpackItem: (request: BackpackMoveRequest) =>
				submit(() =>
					Effect.gen(function* () {
						// Read and execute while this command owns the UI queue. The history
						// resolver rechecks both handles against the authoritative revision.
						const before = yield* live().snapshot;
						const after = yield* live().execute(
							[request],
							undefined,
							before.revision,
						);
						publish(after);
						// Handles travel with whole records, so the committed owner is known
						// without a later snapshot that could already reflect queued Undo.
						return { farmerId: request.toFarmerId, entityId: request.entityId };
					}),
				),
			/** Publish a slot replacement and return its exact committed identity pair. */
			changeBackpackSlot: (request: BackpackLifecycleRequest) =>
				submit(() =>
					Effect.gen(function* () {
						// Resolve the destination before executing within this command queue.
						// Expected revision also protects callers that hold the lower engine API.
						const before = yield* live().snapshot;
						const previous = Object.hasOwn(before.identities, request.farmerId)
							? before.identities[request.farmerId]
							: undefined;
						const slot = previous?.indexOf(request.entityId) ?? -1;
						const after = yield* live().execute(
							[request],
							undefined,
							before.revision,
						);
						const entityId = after.identities[request.farmerId]?.[slot];
						// A successful add/remove always allocates a replacement handle. Read
						// it from that committed state, never from a later snapshot after Undo.
						if (!entityId)
							return yield* Effect.die(
								new Error("Committed backpack replacement has no identity"),
							);
						publish(after);
						return {
							farmerId: request.farmerId,
							previousEntityId: request.entityId,
							entityId,
						};
					}),
				),
			transact: <E>(
				program: Effect.Effect<
					unknown,
					E,
					TransactionDraft | ReviewJournal | BackpackItemEdits
				>,
				expectedRevision?: number,
			) =>
				submit(() =>
					Effect.flatMap(live().transact(program, expectedRevision), (state) =>
						Effect.sync(() => {
							publish(state);
						}),
					),
				),
			execute: (actions: readonly Mutation[], expectedRevision?: number) =>
				submit(() =>
					publishEffect(live().execute(actions, undefined, expectedRevision)),
				),
			undo: () => submit(() => publishEffect(live().undo)),
			redo: () => submit(() => publishEffect(live().redo)),
			export: () =>
				submit(() =>
					Effect.gen(function* () {
						const state = yield* live().snapshot;
						const bytes = yield* codec.encode(state.document);
						const reparsed = yield* codec.decode(bytes);
						// Validate the exact bytes to be downloaded without normalizing
						// the imported baseline or hiding unsupported/modded fields.
						const validation = validateSave(reparsed);
						if (options.validateExport !== false && !validation.valid)
							return yield* new SaveExportRejected({
								message: `Save file not downloaded: ${describeProblems(validation.errors)}`,
								validation,
							});
						return bytes;
					}),
				),
		};
		// Each field snapshot captures its source revision. A dirty draft keeps that
		// handle, so undo/redo or any intervening commit causes an explicit conflict.
		const dateField: Field<GameDate> = {
			label: "Farm date",
			description: "Apply the date as one undoable action.",
			parse: parseDateDraft,
			format: formatDateDraft,
			value: derived(view, (state) => ({
				key: "calendar-date",
				value: state
					? state.calendar.date
					: { year: 1, season: SEASONS[0], day: 1 },
				revision: state?.revision ?? -1,
				available: state !== undefined,
				commit: (value: GameDate) =>
					commands.transact(setCalendarDate(value), state?.revision),
			})),
		};

		return {
			// The UI provider borrows this registry; the Effect file scope remains
			// its sole owner. Expose read-only atom types so bindings cannot bypass
			// explicit commands by assigning a new feature projection.
			atomBindings: {
				registry: registry as AtomRegistry.AtomRegistry,
				view: viewAtom as Atom.Atom<EditorView | undefined>,
				pending: pendingAtom as Atom.Atom<number>,
				notice: noticeAtom as Atom.Atom<
					{ id: number; message: string } | undefined
				>,
			},
			loadValidation,
			commands,
			dismissNotice: () => registry?.set(noticeAtom, undefined),
			// Promise/rejection adapters remain for the original comparator tests.
			// Rendered editing flows use commands and never inspect defect causes.
			view,
			dateField,
			execute,
			transact,
			pending: {
				subscribe: (notify: (value: number) => void) => {
					if (!registry) {
						notify(0);
						return () => {};
					}
					return registry.subscribe(pendingAtom, notify, { immediate: true });
				},
			} satisfies Readable<number>,
			undo: () =>
				command(async () => {
					publish(await run(live().undo));
				}),
			redo: () =>
				command(async () => {
					publish(await run(live().redo));
				}),
			// Encode only the preservation document; session provenance and history
			// remain internal. Decode once to reject an unreadable output before download.
			export: () =>
				command(async () => {
					const state = await run(live().snapshot);
					const bytes = await run(codec.encode(state.document));
					await run(codec.decode(bytes));
					return bytes;
				}),
			snapshot: () => command(() => run(live().snapshot)),
		};
	});
export type EditorModel = Effect.Success<ReturnType<typeof makeEditorModel>>;

// Scope acquisition can fail after some resources exist. Close on every failure
// path as well as normal teardown; callers receive ownership only after success.
/**
 * Decode an import and acquire its calendar session, read models and registry.
 * The caller owns `close()`: unmount registry consumers before awaiting it.
 * Failed acquisition releases resources before rejecting.
 *
 * The production projections and export validation are enabled by default;
 * `includeProofs` and `validateExport: false` support the comparison lab.
 * @returns The application model and the function that closes its file scope.
 */
export async function openEditor(
	bytes: Uint8Array,
	limits: HistoryLimits = {},
	options: { includeProofs?: boolean; validateExport?: boolean } = {},
) {
	const scope = Scope.makeUnsafe();
	try {
		const model = await Effect.runPromise(
			Effect.gen(function* () {
				const codec = yield* SaveCodec;
				const document = yield* codec.decode(bytes);
				const session = yield* makeHistorySession(document, limits);
				return yield* makeEditorModel(session, codec, options);
			}).pipe(
				Effect.provide(SaveCodecLive),
				Effect.provideService(Scope.Scope, scope),
			),
		);
		return {
			model,
			close: () =>
				Effect.runPromise(Scope.close(scope, Exit.succeed(undefined))),
		};
	} catch (error) {
		await Effect.runPromise(Scope.close(scope, Exit.succeed(undefined)));
		throw error;
	}
}
