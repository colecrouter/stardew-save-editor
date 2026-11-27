import * as BrowserWorkerRunner from "@effect/platform-browser/BrowserWorkerRunner";
import { Effect, Layer } from "effect";

import { SaveProcessingServer } from "./save-processing-rpc.ts";
import { WorkerSchedulerLive } from "./worker-scheduler.ts";

// The shared server owns processing and transferable responses. This entry point
// only binds it to browser messages; the Node integration runner binds Node ports.
// The unclamped scheduler keeps Effect's periodic yields from adding seconds of
// browser timer delay to each import and export.
Effect.runFork(
	Layer.launch(
		SaveProcessingServer.pipe(
			Layer.provide(BrowserWorkerRunner.layer),
			Layer.provide(WorkerSchedulerLive),
		),
	),
);
