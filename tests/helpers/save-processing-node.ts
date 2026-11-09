import { Worker } from "node:worker_threads";
import { Layer } from "effect";
import * as NodeWorker from "@effect/platform-node/NodeWorker";
import * as RpcClient from "effect/rpc/RpcClient";
import { SaveProcessingClient } from "../../src/lib/editor/save-processing-rpc.ts";

// Integration tests exercise the production RPC client and handlers with real
// Node threads. NodeWorker owns worker shutdown when the file scope closes.
export const SaveProcessingNode = SaveProcessingClient.pipe(
	Layer.provide(RpcClient.layerProtocolWorker({ size: 1, concurrency: 1 })),
	Layer.provide(
		NodeWorker.layer(
			() =>
				new Worker(
					new URL("./save-processing.node.worker.ts", import.meta.url),
				),
		),
	),
	Layer.orDie,
);
