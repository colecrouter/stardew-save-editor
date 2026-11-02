import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	// Application-owned presentation adapters now resolve catalog/sprite metadata.
	// Match the application asset aliases while retaining the native Node engine
	// tests above this Vite suite as a check against browser-only engine imports.
	resolve: {
		alias: {
			$lib: fileURLToPath(new URL("../../src/lib", import.meta.url)),
			$generated: fileURLToPath(new URL("../../generated", import.meta.url)),
			$types: fileURLToPath(new URL("../../codegen", import.meta.url)),
		},
	},
	test: {
		environment: "node",
		include: ["*.effect.ts"],
		testTimeout: 15000,
	},
});
