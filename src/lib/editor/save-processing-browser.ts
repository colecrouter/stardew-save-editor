import { Effect, Layer } from "effect";
import * as RpcClient from "effect/rpc/RpcClient";
import * as BrowserWorker from "@effect/platform-browser/BrowserWorker";
import * as WorkerPlatform from "effect/workers/Worker";
import { SaveProcessingClient } from "./save-processing-rpc.ts";

// A dedicated worker belongs to one open file. The platform adapter sends close
// messages but does not terminate workers, so scope cleanup must do both.
const platform = Layer.effect(WorkerPlatform.Spawner)(
	Effect.gen(function* () {
		const workers = yield* Effect.acquireRelease(
			Effect.sync(() => new Set<Worker>()),
			(workers) =>
				Effect.sync(() => {
					for (const worker of workers) worker.terminate();
					workers.clear();
				}),
		);
		// A pool restart needs a fresh endpoint, not the worker that just failed.
		// Retain every allocated endpoint for termination when the file closes.
		const spawn = () => {
			const worker = new Worker(
				new URL("./save-processing.worker.ts", import.meta.url),
				{ type: "module" },
			);
			workers.add(worker);
			return worker;
		};
		// Construct the first endpoint during layer acquisition so browser policy
		// failures reach openEditor before RPC starts its background listener.
		// Later pool restarts still receive a fresh endpoint.
		let initial: Worker | undefined = spawn();
		return (_id: number) => {
			const worker = initial ?? spawn();
			initial = undefined;
			return worker;
		};
	}),
);
const protocol = RpcClient.layerProtocolWorker({
	size: 1,
	concurrency: 1,
}).pipe(Layer.provide(Layer.merge(BrowserWorker.layerPlatform, platform)));

// The browser adapter chooses only the platform and worker entry point.
export const SaveProcessingBrowser = SaveProcessingClient.pipe(
	Layer.provide(protocol),
	Layer.orDie,
);
