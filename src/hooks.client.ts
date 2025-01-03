import * as Sentry from "@sentry/sveltekit";
import * as Secrets from "$env/static/public";

const { PUBLIC_SENTRY_DSN: dsn } = Secrets as Record<string, string>;

if (dsn) {
    Sentry.init({
        dsn,

        tracesSampleRate: 1.0,
        integrations: [Sentry.replayIntegration()],
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,
    });
}

export const handleError = dsn ? Sentry.captureException : undefined;
