import * as Sentry from "@sentry/sveltekit";
import { Effect, Result } from "effect";

import {
	BrowserCallFailure,
	chooseSaveDestinationEffect,
	type SaveDownloadStage,
} from "../downloadSave.ts";
import type { EditorModel } from "./editor-model.ts";

type ExportMode = "picker" | "download";
type ExportStage = SaveDownloadStage | "export";
type ExportCommand = EditorModel["commands"]["export"];

// Start the browser picker eagerly to preserve the click's activation. The
// returned Effect owns the rest of this attempt and is run once by the caller.
export function startEditorExport(
	filename: string,
	mode: ExportMode,
	signal: AbortSignal,
	exportSave: ExportCommand,
	onProgress: (status: string) => void,
) {
	const started = performance.now();
	const selection = chooseSaveDestinationEffect(filename, signal, mode);
	// Keep each report scoped to this attempt and omit file identity and bytes.
	const diagnostics = (stage: ExportStage) => ({
		mode,
		stage,
		duration_ms: Math.round(performance.now() - started),
	});
	const report = (stage: ExportStage, outcome: string) =>
		Sentry.logger.info("Save download outcome", {
			...diagnostics(stage),
			outcome,
		});

	return Effect.gen(function* () {
		const destination = yield* Effect.tryPromise({
			try: () => selection,
			catch: (cause) =>
				cause instanceof BrowserCallFailure
					? cause
					: new BrowserCallFailure({ stage: "picker", cause }),
		});
		// Closing or replacing the session abandons work without publishing UI.
		if (signal.aborted) return { outcome: "abandoned" } as const;
		if (!destination) {
			report("picker", "cancelled");
			return { outcome: "cancelled" } as const;
		}

		// The model queues export behind pending edits and validates the bytes.
		onProgress("Preparing save…");
		const result = yield* Effect.tryPromise({
			try: () => exportSave(),
			catch: (cause) => ({ stage: "export" as const, cause }),
		});
		if (!result || signal.aborted) return { outcome: "abandoned" } as const;
		if (Result.isFailure(result)) {
			report("export", "export_rejected");
			return { outcome: "export_rejected", result } as const;
		}

		// Acquire the writable only once we have validated bytes. A standard
		// download confirms browser handoff, while a closed stream confirms a write.
		onProgress("Writing save…");
		// Blob allocation can fail synchronously on large exports. Report it as
		// preparation failure so the same recovery path handles it.
		const blob = yield* Effect.try({
			try: () =>
				new Blob([result.success], { type: "application/octet-stream" }),
			catch: (cause) => ({ stage: "export" as const, cause }),
		});
		const completed = yield* destination.write(blob, signal);
		const outcome = !completed
			? "cancelled"
			: destination.completion === "close"
				? "written"
				: "download_started";
		report(completed ? destination.completion : "abort", outcome);
		return { outcome } as const;
	}).pipe(
		Effect.catch(({ stage, cause }) =>
			Effect.sync(() => {
				report(stage, "failed");
				// Console capture records one event with local tags and the raw error.
				Sentry.withScope((scope) => {
					scope.setTag("save_download.stage", stage);
					scope.setTag("save_download.mode", mode);
					scope.setTag(
						"save_download.error_name",
						cause instanceof Error || cause instanceof DOMException
							? cause.name
							: "Unknown",
					);
					scope.setContext("save_download", diagnostics(stage));
					console.error("Save download failed", cause);
				});
				return { outcome: "failed", stage } as const;
			}),
		),
	);
}
