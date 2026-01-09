import * as Sentry from "@sentry/sveltekit";
import { handleErrorWithSentry, sentryHandle } from "@sentry/sveltekit";
import { sequence } from "@sveltejs/kit/hooks";
import { dev } from "$app/environment";

dev ||
	Sentry.init({
		dsn: "https://3567a44e61e1ade55642d2d49277e73a@o4508581503172608.ingest.us.sentry.io/4508581737136128",

		tracesSampleRate: 1.0,

		// uncomment the line below to enable Spotlight (https://spotlightjs.com)
		// spotlight: import.meta.env.DEV,
	});

// If you have custom handlers, make sure to place them after `sentryHandle()` in the `sequence` function.
export const handle = dev ? undefined : sequence(sentryHandle());

// If you have a custom error handler, pass it to `handleErrorWithSentry`
export const handleError = dev ? undefined : handleErrorWithSentry();
