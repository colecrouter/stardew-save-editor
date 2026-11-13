import { Effect, Layer, Schema } from "effect";
import * as RpcClient from "effect/rpc/RpcClient";
import * as RpcServer from "effect/rpc/RpcServer";
import { SaveReadError } from "./save-service.ts";
import type { SaveDocument } from "./domain.ts";
import {
	SaveProcessor,
	SaveProcessingSync,
	SaveExportFailed,
	SaveExportRejected,
} from "./save-processing.ts";
import * as Rpc from "effect/rpc/Rpc";
import * as RpcGroup from "effect/rpc/RpcGroup";
import * as Transferable from "effect/workers/Transferable";

// RPC derives JSON codecs even on worker transports. Unknown's JSON codec would
// reject bigint IDs, so this declaration explicitly preserves structured-clone
// values. The XML codec validates the document; this boundary neither projects
// its fields nor detaches buffers belonging to the live editor state.
const StructuredCloneValue = Transferable.schema(
	Schema.declare((_value): _value is unknown => true),
	() => [],
);

// Blob is structured-cloned as an immutable file; the worker reads its
// stream locally. It must not pass through a JSON object projection.
const BlobValue = Transferable.schema(
	Schema.declare((value): value is Blob => value instanceof Blob),
	() => [],
);

// Parser causes may contain uploaded XML. Send only the recovery category back
// to the browser, where the normal import boundary supplies user-facing wording.
export class SaveImportRejected extends Schema.TaggedError<
	SaveImportRejected,
	{ readonly brand: unique symbol }
>()("SaveImportRejected", {
	stage: Schema.Literals(["decompress", "xml", "shape", "version", "worker"]),
}) {}

// The save is intentionally opaque on the wire: a closed schema for game fields
// would strip unfamiliar mod data. The codec checks the exported envelope again.
// Import transfers a dedicated byte copy; export transfers its new output buffer.
// Live editor state stays owned by the main thread and enters through structured clone.
export const SaveProcessingRpc = RpcGroup.make(
	Rpc.make("importSave", {
		payload: { bytes: Transferable.Uint8Array },
		success: Schema.Struct({
			document: StructuredCloneValue,
			validation: Schema.Struct({
				valid: Schema.Boolean,
				errors: Schema.mutable(Schema.Array(Schema.String)),
				warnings: Schema.mutable(Schema.Array(Schema.String)),
			}),
		}),
		error: SaveImportRejected,
	}),
	Rpc.make("importBlob", {
		payload: { blob: BlobValue },
		success: Schema.Struct({
			document: StructuredCloneValue,
			validation: Schema.Struct({
				valid: Schema.Boolean,
				errors: Schema.mutable(Schema.Array(Schema.String)),
				warnings: Schema.mutable(Schema.Array(Schema.String)),
			}),
		}),
		error: SaveImportRejected,
	}),
	Rpc.make("exportSave", {
		payload: { document: StructuredCloneValue, validate: Schema.Boolean },
		success: Transferable.Uint8Array,
		error: Schema.Union([SaveExportRejected, SaveExportFailed]),
	}),
);

// Transport failures are retryable typed failures; RPC server defects stay defects
// and reach the model's shared reporting boundary rather than masquerading as data.
export const SaveProcessingClient = Layer.effect(SaveProcessor)(
	Effect.gen(function* () {
		const client = yield* RpcClient.make(SaveProcessingRpc);
		return SaveProcessor.of({
			// openEditor does not consume its caller's bytes. Transfer a dedicated
			// copy so fixtures, retry inputs and original backups remain usable.
			import: (bytes) =>
				Effect.suspend(() =>
					client.importSave({ bytes: Uint8Array.from(bytes) }),
				).pipe(
					Effect.map((result) => ({
						...result,
						document: result.document as SaveDocument,
					})),
					Effect.catchTags({
						SaveImportRejected: (error) =>
							Effect.fail(
								new SaveReadError({ stage: error.stage, cause: undefined }),
							),
						RpcClientError: (error) =>
							error.reason._tag === "RpcClientDefect"
								? Effect.die(error.reason)
								: Effect.fail(
										new SaveReadError({ stage: "worker", cause: error.reason }),
									),
					}),
				),
			importBlob: (blob) =>
				Effect.suspend(() => client.importBlob({ blob })).pipe(
					Effect.map((result) => ({
						...result,
						document: result.document as SaveDocument,
					})),
					Effect.catchTags({
						SaveImportRejected: (error) =>
							Effect.fail(
								new SaveReadError({ stage: error.stage, cause: undefined }),
							),
						RpcClientError: (error) =>
							error.reason._tag === "RpcClientDefect"
								? Effect.die(error.reason)
								: Effect.fail(
										new SaveReadError({ stage: "worker", cause: error.reason }),
									),
					}),
				),
			export: (document, validate) =>
				client.exportSave({ document, validate }).pipe(
					Effect.catchTag("RpcClientError", (error) =>
						error.reason._tag === "RpcClientDefect"
							? Effect.die(error.reason)
							: Effect.fail(
									new SaveExportFailed({
										stage: "worker",
										message:
											"The save export worker is unavailable. Please try again or reopen the save.",
									}),
								),
					),
				),
		});
	}),
);

// Browser and Node runners use the same handlers and schema/transfer protocol.
// Only the runner platform differs; codec behavior cannot drift between tests
// and the production worker.
const handlers = SaveProcessingRpc.toLayer(
	Effect.gen(function* () {
		const processor = yield* SaveProcessor;
		return {
			importSave: ({ bytes }) =>
				processor
					.import(bytes)
					.pipe(
						Effect.mapError(
							(error) => new SaveImportRejected({ stage: error.stage }),
						),
					),
			importBlob: ({ blob }) => {
				if (!processor.importBlob)
					return Effect.die(new Error("Worker blob processing unavailable"));
				return processor
					.importBlob(blob)
					.pipe(
						Effect.mapError(
							(error) => new SaveImportRejected({ stage: error.stage }),
						),
					);
			},
			exportSave: ({ document, validate }) =>
				processor.export(document as SaveDocument, validate),
		};
	}),
).pipe(Layer.provide(SaveProcessingSync));

export const SaveProcessingServer = RpcServer.layer(SaveProcessingRpc).pipe(
	Layer.provide(handlers),
	Layer.provide(RpcServer.layerProtocolWorkerRunner),
);
