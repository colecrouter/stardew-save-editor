import * as Sentry from "@sentry/sveltekit";
import {
	captureConsoleIntegration,
	handleErrorWithSentry,
	replayIntegration,
} from "@sentry/sveltekit";
import { dev } from "$app/environment";

dev ||
	Sentry.init({
		dsn: "https://3567a44e61e1ade55642d2d49277e73a@o4508581503172608.ingest.us.sentry.io/4508581737136128",

		tracesSampleRate: 1.0,

		// This sets the sample rate to be 10%. You may want this to be 100% while
		// in development and sample at a lower rate in production
		replaysSessionSampleRate: 0,

		// If the entire session is not sampled, use the below sample rate to sample
		// sessions when an error occurs.
		replaysOnErrorSampleRate: 1.0,

		// If you don't want to use Session Replay, just remove the line below:
		integrations: [
			replayIntegration({
				// NOTE: This will disable built-in masking. Only use this if your site has no sensitive data, or if you've already set up other options for masking or blocking relevant data, such as 'ignore', 'block', 'mask' and 'maskFn'.
				maskAllText: false,
				blockAllMedia: false,
			}),
			captureConsoleIntegration({ levels: ["error"] }),
		],

		ignoreErrors: [
			// This appears to be a common cache miss error(?)
			"dynamically imported module",
			"Unable to preload CSS for",
			"Importing a module script failed.",
		],

		enableLogs: true,
	});

// If you have a custom error handler, pass it to `handleErrorWithSentry`
export const handleError = dev ? undefined : handleErrorWithSentry();

export const init = async () => {
	// https://github.com/sveltejs/kit/issues/7805
	// Polyfills for Safari <18
	// If more polyfills are needed, they can be added here.

	// @ts-expect-error no d.ts declaration
	if (!("groupBy" in Map)) await import("core-js/es/map/group-by");
	// @ts-expect-error no d.ts declaration
	if (!("filter" in [].values())) await import("core-js/es/iterator");
};
