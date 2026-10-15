import * as Sentry from "@sentry/sveltekit";
import { handleErrorWithSentry, sentryHandle } from "@sentry/sveltekit";
import { sequence } from "@sveltejs/kit/hooks";
import { dev } from "$app/environment";

// Error reporting is off unless a Sentry DSN is provided at build time
const dsn: string | undefined = import.meta.env.VITE_SENTRY_DSN || undefined;
const enabled = !dev && dsn !== undefined;

enabled &&
	Sentry.init({
		dsn,

		tracesSampleRate: 1.0,

		// uncomment the line below to enable Spotlight (https://spotlightjs.com)
		// spotlight: import.meta.env.DEV,
	});

// If you have custom handlers, make sure to place them after `sentryHandle()` in the `sequence` function.
export const handle = !enabled ? undefined : sequence(sentryHandle());

// If you have a custom error handler, pass it to `handleErrorWithSentry`
export const handleError = !enabled ? undefined : handleErrorWithSentry();
