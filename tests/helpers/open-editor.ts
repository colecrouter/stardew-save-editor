import { Effect, Exit, Scope } from "effect";

import type { SaveDocument } from "../../src/lib/editor/domain.ts";
import {
	makeEditorModel,
	openEditor as openApplicationEditor,
	type OpenEditorOptions,
} from "../../src/lib/editor/editor-model.ts";
import {
	type HistoryLimits,
	makeHistorySession,
} from "../../src/lib/editor/history.ts";
import {
	SaveProcessingSync,
	SaveProcessor,
} from "../../src/lib/editor/save-processing.ts";
import { parser } from "./editor-document.ts";

/** UI tests own the production model and scope, without repeating an expensive
 * import for every interaction. Codec integration tests use openEditor directly. */
export async function openTestDocument(
	document: SaveDocument,
	limits: HistoryLimits = {},
	options: Pick<OpenEditorOptions, "includeProofs" | "validateExport"> = {},
) {
	const scope = Scope.makeUnsafe();
	try {
		const model = await Effect.runPromise(
			Effect.gen(function* () {
				const processor = yield* SaveProcessor;
				const session = yield* makeHistorySession(document, limits);
				// Optional flags can arrive explicitly unavailable from an application callback.
				// Forward only chosen values to the model's exact optional representation.
				const modelOptions = {
					...(options.includeProofs === undefined
						? {}
						: { includeProofs: options.includeProofs }),
					...(options.validateExport === undefined
						? {}
						: { validateExport: options.validateExport }),
				};
				return yield* makeEditorModel(session, processor, modelOptions);
			}).pipe(
				Effect.provide(SaveProcessingSync),
				Effect.provideService(Scope.Scope, scope),
			),
		);
		return {
			model,
			close: () =>
				Effect.runPromise(Scope.close(scope, Exit.succeed(undefined))),
		};
	} catch (cause) {
		await Effect.runPromise(Scope.close(scope, Exit.succeed(undefined)));
		throw cause;
	}
}
/** Reuse only fixture parsing; the actual export service stays connected. */
export const openTestEditor = (
	bytes: Uint8Array,
	limits: HistoryLimits = {},
	options: Pick<OpenEditorOptions, "includeProofs" | "validateExport"> = {},
) =>
	openTestDocument(
		parser.parse(new TextDecoder().decode(bytes)),
		limits,
		options,
	);

/** Import-boundary tests choose synchronous processing explicitly; UI fixtures
 * can continue opening an already decoded document through openTestDocument. */
export const openEditor = (
	bytes: Uint8Array,
	limits: HistoryLimits = {},
	options: OpenEditorOptions = {},
) => openApplicationEditor(SaveProcessingSync, bytes, limits, options);
