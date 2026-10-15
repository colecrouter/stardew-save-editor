import * as Sentry from "@sentry/sveltekit";
import {
	captureConsoleIntegration,
	handleErrorWithSentry,
	replayIntegration,
} from "@sentry/sveltekit";
import { dev } from "$app/environment";

// Error reporting is off unless a Sentry DSN is provided at build time
const dsn: string | undefined = import.meta.env.VITE_SENTRY_DSN || undefined;
const enabled = !dev && dsn !== undefined;

enabled &&
	Sentry.init({
		dsn,

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
			Sentry.browserSessionIntegration({
				lifecycle: "page",
			}),
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
export const handleError = !enabled ? undefined : handleErrorWithSentry();
