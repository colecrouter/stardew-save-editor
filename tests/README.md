# Tests

- `npm test`: application/domain/component and retained legacy regressions (Vitest,
  happy-dom). Files named `e2e` here are integration tests, not real-browser tests.
- `npm run test:editor`: the narrower application editor suite.
- `npm run test:game-data`: .NET 10 inspection/generation, generated-module
  type checks, XML codec behavior, and synthetic XmlSerializer interoperability.
  It rebuilds ignored test output; no game installation is required.
- `npm ci --prefix tests/engine`, then `npm test --prefix tests/engine`: engine
  contracts plus native Node import/codec checks. This package uses Vitest 5 because
  the Effect test adapter requires it; the application runner remains Vitest 3. The Node platform shared package is pinned
  to the tested 4.0.6 API alongside Effect.
- `npm run check --prefix tests/engine` and `npm run effect:diagnostics --prefix tests/engine`:
  standalone engine typing and Effect diagnostics.

Shared fixture builders live in `tests/helpers/editor-document.ts`; Vite and Node
retain separate public-save loaders. The application runner decodes the public save
once in global setup, writes a temporary V8 snapshot (preserving bigint), and gives
each isolated file its own baseline. Every fixture request returns a fresh
`structuredClone`; edited XML still goes through the real decoder. The snapshot
is removed at teardown and is never committed. The runner uses at most two workers (one on single-core hosts) to leave memory
for Vite, isolated schema graphs, and full-save DOM tests.

`tests/editor/workspace.ts` owns common workspace setup and unmount-before-file-close cleanup. Keep feature assertions and
special cancellation/lifetime setup explicit. Use `tinyFixture` for rule tests and
`tinyEditorFixture` when a model also needs a calendar projection. Retain full-save
cases for preservation. Full import/export assertions have explicit
budgets for the event-based codec; pure rule tests keep the default budget.
UI interaction suites can open decoded fixtures through
`tests/helpers/open-editor.ts`. This uses the production model, history and export
service while avoiding a full XML import for each interaction. Application/engine
codec tests retain the real byte import boundary; malformed in-memory domain tests
do not first serialize values that the codec is expected to reject.
Never commit private user saves.

Engine comparison executors and store/Atom harnesses are test-only reference
fixtures, not alternate application runtimes. Their assertions remain until
superseded deliberately. Native Node tests run without Vite and catch browser-only
imports; happy-dom cannot replace them. No coverage percentage is currently measured.

For production browser smoke, build and run preview separately, then:

```sh
node --import tsx tools/smoke-editor-browser.mjs
```

Use `--url` for a different full editor URL, `--chromium` for an installed executable
and `--output` for evidence (default `/tmp/v2-browser-smoke.json`). It checks four
viewport sizes, edit/history, desktop native drag and exact export/reimport. It
starts no server and installs no browser. Restart preview after rebuilding.
Native devices, VoiceOver and performance budgets remain separate qualifications.
