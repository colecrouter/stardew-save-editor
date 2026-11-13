import { Effect, Layer } from "effect";
import * as NodeWorkerRunner from "@effect/platform-node/NodeWorkerRunner";
import { SaveProcessingServer } from "../../src/lib/editor/save-processing-rpc.ts";

// Run the same handlers as the browser worker, over the native Node port.
Effect.runFork(
	Layer.launch(
		SaveProcessingServer.pipe(Layer.provide(NodeWorkerRunner.layer)),
	),
);
