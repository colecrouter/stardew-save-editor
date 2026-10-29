import { immutableView, type ImmutableView } from "./immutable-view.ts";
import { readFarmerChoices } from "./farmer-selection.ts";
import { readQuestJournals, type QuestFarmerView } from "./quest-operations.ts";
import { readQiOrders, type QiOrdersView } from "./qi-order-operations.ts";
import { readEvents, type EventFarmerView } from "./event-operations.ts";
import { readRecipes, type RecipeFarmerView } from "./recipe-operations.ts";
import {
	readAppearances,
	type AppearanceView,
} from "./appearance-operations.ts";
import {
	readRelationships,
	type RelationshipFarmerView,
} from "./relationship-operations.ts";
import type { EditGesture } from "./edit-gesture.ts";
import { readCharacters, type CharacterView } from "./character-operations.ts";
import type { BackpackMoveRequest } from "./backpack-movement.ts";
import type { BackpackLifecycleRequest } from "./backpack-lifecycle.ts";
import { type BackpackItemEdits } from "./inventory-operations.ts";
import {
	readBackpacks,
	readChests,
	type BackpackView,
} from "./inventory-views.ts";
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
	Option,
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
import { MutationError, type Mutation } from "./domain.ts";
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
interface EditorViewData {
	readonly revision: number;
	readonly bundle: ReturnType<typeof springBundleView>;
	readonly calendar: CalendarViewState;
	readonly farm: FarmView;
	readonly backpacks: readonly BackpackView[];
	readonly chests: readonly BackpackView[];
	readonly characters: CharacterView[];
	readonly farmerChoices: ReturnType<typeof readFarmerChoices>;
	readonly recipes: RecipeFarmerView[];
	readonly events: EventFarmerView[];
	readonly questJournals: QuestFarmerView[];
	readonly qiOrders: QiOrdersView;
	readonly appearances: AppearanceView[];
	readonly relationships: RelationshipFarmerView[];
	readonly greenRain: number;
	readonly todayOptions: WeatherChoice[];
	readonly tomorrowOptions: WeatherChoice[];
	readonly todayReason?: string;
	readonly tomorrowReason?: string;
	readonly canUndo: boolean;
	readonly canRedo: boolean;
	readonly retainedBytes: number;
	readonly dropped: number;
	readonly entries: {
		id: number;
		label: string;
		compact: boolean;
		applied: boolean;
		paths: string[];
		annotations: HistoryState["entries"][number]["annotations"];
	}[];
	readonly net: JsonPatch.JsonPatch;
	readonly farmerId: string;
	readonly backpackSize: number;
}

/** Component-facing committed values; all nested data is immutable. */
export type EditorView = ImmutableView<EditorViewData>;

// Build the feature projection from committed state only. Form drafts never
// enter this function, and projection must not normalize the imported document.
function project(
	state: HistoryState,
	includeProofs = false,
	chests: readonly BackpackView[] = readChests(state),
): EditorView {
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
		chests,
		characters: readCharacters(state.document),
		farmerChoices: readFarmerChoices(state.document),
		recipes: readRecipes(state.document),
		events: readEvents(state.document),
		questJournals: readQuestJournals(state.document),
		qiOrders: readQiOrders(state.document),
		appearances: readAppearances(state.document),
		relationships: readRelationships(state.document),
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
		net: state.net,
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
		let chestCache:
			| { revision: number; value: ImmutableView<BackpackView[]> }
			| undefined;
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
						chestCache = undefined;
						resources.registries--;
					}),
			);
		// Keep projections while panels have no consumers. Registry disposal, rather
		// than temporary unmounting, defines their lifetime within this session.
		const viewAtom = Atom.make<EditorView | undefined>(undefined).pipe(
			Atom.keepAlive,
		);
		const selectedFarmerAtom = Atom.make<string | undefined>(undefined).pipe(
			Atom.keepAlive,
		);
		// Handles contain no save data. A WeakMap limits their authority to the
		// model that allocated them without retaining unmounted field instances.
		const gestures = new WeakMap<EditGesture, string>();
		let nextGesture = 0;
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
		// One canonical immutable chest view belongs to this file, not a revision
		// archive. Public mutations cannot poison a cache hit. Replacing the cache
		// releases the previous descriptor tree; closure clears it as well.
		const publish = (state: HistoryState) => {
			if (
				!closed &&
				registry &&
				state.revision > (registry.get(viewAtom)?.revision ?? -1)
			) {
				if (!chestCache || chestCache.revision !== state.chestRevision) {
					chestCache = {
						revision: state.chestRevision,
						value: immutableView(readChests(state)),
					};
				}
				const next = immutableView(
					project(state, options.includeProofs, chestCache.value),
				);
				registry.set(viewAtom, next);
				// Selection belongs to the file, not a page index. Preserve its
				// stable ID through revisions; only unavailable/ambiguous owners
				// fall back to the first currently supported farmer.
				const choices = next.farmerChoices.filter(
					(character) => character.supported,
				);
				if (
					!choices.some(
						(character) =>
							character.farmerId === registry?.get(selectedFarmerAtom),
					)
				)
					registry.set(selectedFarmerAtom, choices[0]?.farmerId);
			}
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
				// The command result may already have projected this revision. Skip
				// that duplicate before history detaches the full preservation document.
				// Lower-level writes and other models still arrive through this stream.
				return session.changesAfter(() => registry?.get(viewAtom)?.revision);
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
			preserveEdit = false,
		): Promise<CommandResult<A, E | MutationError>> => {
			if (closed) return Promise.resolve(null);
			return command(async () => {
				if (closed) return null;
				const exit = await runExitWithContext(
					Effect.gen(function* () {
						const fiber = yield* Effect.forkScoped(
							Effect.gen(function* () {
								// A different command is a gesture boundary even when
								// its domain operation is subsequently rejected.
								if (!preserveEdit) yield* live().endEdit();
								return yield* Effect.suspend(work);
							}),
						);
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
		const edits = {
			// Symbols survive reactive descriptor wrapping without proxy identity drift.
			scope: Symbol("editor-fields"),
			endActive: () => submit(() => live().endEdit(), true),
			begin: (fieldKey: string): EditGesture => {
				const gesture = Object.freeze({ fieldKey });
				gestures.set(gesture, `edit:${++nextGesture}:${fieldKey}`);
				return gesture;
			},
			end: (gesture: EditGesture) =>
				submit(() => {
					const key = gestures.get(gesture);
					return key === undefined
						? Effect.fail(
								new MutationError("This edit belongs to another save session."),
							)
						: live().endEdit(key);
				}, true),
		};
		const commands = {
			edit: <E>(
				program: Effect.Effect<
					unknown,
					E,
					TransactionDraft | ReviewJournal | BackpackItemEdits
				>,
				gesture: EditGesture,
			) =>
				submit(() => {
					const key = gestures.get(gesture);
					if (key === undefined)
						return Effect.fail(
							new MutationError("This edit belongs to another save session."),
						);
					return Effect.asVoid(
						publishEffect(live().transact(program, undefined, key)),
					);
				}, true),
			selectFarmer: (farmerId: string) =>
				submit(() =>
					Effect.gen(function* () {
						const state = yield* live().snapshot;
						if (
							!readFarmerChoices(state.document).some(
								(character) =>
									character.supported && character.farmerId === farmerId,
							)
						)
							return yield* new MutationError(
								"Choose a farmer with an unambiguous saved identifier.",
							);
						if (registry) registry.set(selectedFarmerAtom, farmerId);
					}),
				),
			/** Move or swap farmer slots or virtual chest targets, returning the moved instance. */
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
						const after = yield* live().execute(
							[request],
							undefined,
							before.revision,
						);
						// One lifecycle request allocates exactly one replacement. Chest
						// compaction may move it away from the requested display position.
						const entityId =
							after.nextIdentity === before.nextIdentity + 1
								? `item:${after.nextIdentity}`
								: undefined;
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
			transact: <A, E>(
				program: Effect.Effect<
					A,
					E,
					TransactionDraft | ReviewJournal | BackpackItemEdits
				>,
				expectedRevision?: number,
			) =>
				submit(() =>
					Effect.gen(function* () {
						// The history transaction owns publication; its result is the new state.
						// Capture the domain receipt per queued submission and expose it only
						// after that transaction succeeds. Failed/retried attempts never emit it.
						const receipt: { current: Option.Option<A> } = {
							current: Option.none(),
						};
						const state = yield* live().transact(
							program.pipe(
								Effect.tap((value) =>
									Effect.sync(() => {
										receipt.current = Option.some(value);
									}),
								),
							),
							expectedRevision,
						);
						publish(state);
						if (Option.isNone(receipt.current))
							return yield* Effect.die(
								new Error("A committed transaction has no domain receipt"),
							);
						return receipt.current.value;
					}),
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
				selectedFarmerId: selectedFarmerAtom as Atom.Atom<string | undefined>,
				pending: pendingAtom as Atom.Atom<number>,
				notice: noticeAtom as Atom.Atom<
					{ id: number; message: string } | undefined
				>,
			},
			loadValidation,
			commands,
			edits,
			selectedFarmerId: {
				subscribe: (notify: (value: string | undefined) => void) => {
					if (!registry) {
						notify(undefined);
						return () => {};
					}
					return registry.subscribe(selectedFarmerAtom, notify, {
						immediate: true,
					});
				},
			} satisfies Readable<string | undefined>,
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
					await run(live().endEdit());
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
