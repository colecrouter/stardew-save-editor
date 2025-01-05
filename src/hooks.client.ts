import { handleErrorWithSentry, replayIntegration } from "@sentry/sveltekit";
import * as Sentry from "@sentry/sveltekit";

Sentry.init({
    dsn: "https://3567a44e61e1ade55642d2d49277e73a@o4508581503172608.ingest.us.sentry.io/4508581737136128",

    tracesSampleRate: 1.0,

    // This sets the sample rate to be 10%. You may want this to be 100% while
    // in development and sample at a lower rate in production
    replaysSessionSampleRate: 0.1,

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
    ],
});

// If you have a custom error handler, pass it to `handleErrorWithSentry`
export const handleError = handleErrorWithSentry();
