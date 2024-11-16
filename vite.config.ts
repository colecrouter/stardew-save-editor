import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";
import { svelteTesting } from "@testing-library/svelte/vite";

export default defineConfig({
    plugins: [sveltekit(), svelteTesting()],
    server: {
        fs: {
            allow: [".."],
        },
    },
    optimizeDeps: {
        include: ["idb"],
    },
    test: {
        environment: "happy-dom",
        setupFiles: ["./test/vitest-setup.ts"],
    },
});
