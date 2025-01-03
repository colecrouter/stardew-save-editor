import { sentrySvelteKit } from "@sentry/sveltekit";
import { sveltekit } from "@sveltejs/kit/vite";
import { svelteTesting } from "@testing-library/svelte/vite";
import { defineConfig, loadEnv } from "vite";

// Load environment variables from .env
const env = loadEnv("", process.cwd(), "BUILD");

export default defineConfig({
    plugins: [
        sveltekit(),
        svelteTesting(),
        sentrySvelteKit({
            sourceMapsUploadOptions: {
                authToken: env.BUILD_SENTRY_AUTH_TOKEN,
                org: env.BUILD_SENTRY_ORG,
                project: env.BUILD_SENTRY_PROJECT,
            },
        }),
    ],
    server: {
        fs: {
            allow: [".."],
        },
    },
    optimizeDeps: {
        include: ["idb", "@thisux/sveltednd"],
    },
    // @ts-expect-error vitest not supporting Vite 6 yet
    test: {
        environment: "happy-dom",
        setupFiles: ["./test/vitest-setup.ts"],
    },
});
