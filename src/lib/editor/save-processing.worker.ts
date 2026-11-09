import { Effect, Layer } from "effect";
import * as BrowserWorkerRunner from "@effect/platform-browser/BrowserWorkerRunner";
import { SaveProcessingServer } from "./save-processing-rpc.ts";

// The shared server owns processing and transferable responses. This entry point
// only binds it to browser messages; the Node integration runner binds Node ports.
Effect.runFork(
	Layer.launch(
		SaveProcessingServer.pipe(Layer.provide(BrowserWorkerRunner.layer)),
	),
);
