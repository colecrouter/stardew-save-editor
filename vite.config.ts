import { sentrySvelteKit } from "@sentry/sveltekit";
import { sveltekit } from "@sveltejs/kit/vite";
import { svelteTesting } from "@testing-library/svelte/vite";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [
        sentrySvelteKit({
            sourceMapsUploadOptions: {
                org: "cole-crouter",
                project: "stardew-save-editor",
            },
        }),
        sveltekit(),
        svelteTesting(),
    ],
    server: {
        fs: {
            allow: [".."],
        },
    },
    optimizeDeps: {
        include: ["idb", "@thisux/sveltednd"],
    },
    // @ts-expect-error TODO: fix vitest/config
    test: {
        environment: "happy-dom",
        setupFiles: ["./test/vitest-setup.ts"],
    },
});
