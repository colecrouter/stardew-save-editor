# Tests

- `npm run test:asset-dump`: catalog extraction regressions and filesystem publication/rollback
  for the .NET generator; no game installation or graphics device required.
- `npm test`: application/domain/component and retained legacy regressions (Vite+ Vitest 5,
  happy-dom). Files named `e2e` here are integration tests, not real-browser tests.
- `npm run test:editor`: the narrower application editor suite.
- `npm run test:game-data`: .NET 10 inspection/generation, generated-module
  type checks, XML codec behavior, and synthetic XmlSerializer interoperability.
  It rebuilds ignored test output; no game installation is required.
- `npm run check:tests`: native TypeScript and Svelte checks for application test
  files and component harnesses.
- `npm ci --prefix tests/engine`, then `npm test --prefix tests/engine`: engine
  contracts plus native Node import/codec checks. Both runners use Vitest 5; this
  package remains independently installed so native engine checks retain their
  own dependency boundary. The Node platform shared package is pinned to the
  tested 4.0.6 API alongside Effect.
- `npm run check --prefix tests/engine` and `npm run effect:diagnostics --prefix tests/engine`:
  standalone engine typing and Effect diagnostics.

The app and its shared tests use one npm installation with separate TypeScript
scopes. The root `tsconfig.json` lets editors discover the app, test and tooling
projects while leaving file ownership to those scopes. `tsconfig.app.json` checks browser
application code; `tsconfig.tests.json`
adds the test environment without introducing Node globals into the app scope.
`tsconfig.node.json` covers build and development tooling. The independent engine
runner keeps `tests/engine/tsconfig.json`.

Shared fixture builders live in `tests/helpers/editor-document.ts`; Vite and Node
retain separate public-save loaders. The application runner decodes the public save
once in global setup, writes a temporary V8 snapshot (preserving bigint), and gives
each isolated file its own baseline. Every fixture request returns a fresh
`structuredClone`; edited XML still goes through the real decoder. The snapshot
is removed at teardown and is never committed. Vitest chooses worker concurrency from the available CPUs.

`tests/editor/workspace.ts` owns common workspace setup and unmount-before-file-close cleanup. Keep feature assertions and
special cancellation/lifetime setup explicit. Use `tinyFixture` for rule tests and
`tinyEditorFixture` when a model also needs a calendar projection. Retain full-save
cases for preservation. Full import/export assertions have explicit
budgets for the event-based codec; pure rule tests keep the default budget. These
budgets detect stuck correctness tests, not acceptable runtime latency. Use the
separate full-save probe in `npm run benchmark:toolchain` to compare codec-heavy
work across revisions; the small inventory probe does not exercise that boundary.
UI interaction suites can open decoded fixtures through
`tests/helpers/open-editor.ts`. This uses the production model, history and export
service while avoiding a full XML import for each interaction. Application/engine
codec tests retain the real byte import boundary; malformed in-memory domain tests
do not first serialize values that the codec is expected to reject.
Never commit private user saves.

`openEditor(processingLayer, bytes, ...)` requires an explicit execution choice.
The app supplies `SaveProcessingBrowser`. Component/unit fixtures and CPU-only
profiling select `SaveProcessingSync`; tests that only need a failure or pending
operation can supply a mock layer. Engine application integration tests select
`SaveProcessingNode` from `tests/helpers/save-processing-node.ts`, exercising real
worker threads with the same RPC client and handlers as the browser. Keep the Node
adapter beside these shared helpers so it resolves the app's Effect installation,
rather than mixing the engine test package's separate runtime into the transport.

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

To investigate native save-picker activation, run an existing dev server and then:

```sh
node tools/probe-save-picker-browser.mjs --output /tmp/save-picker-probe.json
```

This uses installed Chrome and the public `TestSave` fixture at
1×, 6× and 20× CPU throttling. It records activation at the trusted click and
picker call, picker acquisition latency, and Chrome's native rejection. Headless
`AbortError` means the picker request was canceled; `SecurityError` with inactive
activation reproduces the production failure. It adds no synthetic export delay.
Use `--url` for a production preview or deployed build and `--channel` for another
installed Chromium channel. Sentry requests are blocked to avoid recording probe
errors in production. The probe observes behavior rather than asserting a timing
budget, since execution time depends on the machine and browser. It asserts that
activation is still present at the picker; cancellation then skips export.

To compare export preparation in the current V2 and legacy editors, build and
start production preview, then run:

```sh
node tools/benchmark-export-browser.mjs --output /tmp/export-benchmark.json
```

The benchmark imports the same public fixture into each editor, accepts a fake
destination without writing to disk, and reports the median of five warmed exports after a separate
first sample. OS picker interaction and disk writes are excluded. It also records
main-thread clone timings, picker latency and heartbeat stalls. Use `--url` for another base URL, including its trailing
slash. The 1× result compares ordinary wall time; the 6× result diagnoses where
work runs. Chrome's renderer CPU throttle leaves the legacy XML worker unthrottled,
so the latter is **not** an equal-speed comparison of slower devices.

To exercise V2's actual import/export Effect worker transport against production preview:

```sh
npx playwright install chromium
npm run test:browser:save-processing -- --output /tmp/save-worker.json
```

This uses Playwright Chromium and the public fixture; pass `--channel chrome` or
`--chromium /path/to/chromium` to use an installed browser instead. CI runs this command against a production build and
retains JSON and screenshot evidence. It checks worker constructor/module-load
failures and successful retry, compressed import,
import cancellation and error recovery, loading phases and disabled duplicate
actions, full parsed-save preservation, sender buffer detachment after transfer,
typed validation failures, termination while a response is pending, and retry
after an injected worker error. Input transfer leaves the caller's bytes intact.
The destination is simulated without writing to disk; Sentry traffic is blocked.
Use `--url` to override the default preview URL. With `--output`, loading screenshots
are saved alongside the JSON evidence. The ordinary browser smoke also
checks the anchor fallback, editing/history and reimport at four viewport sizes.

Component coverage in `tests/editor/import-loading.svelte.test.ts` also cancels
while the processing layer is still acquiring, verifies resource release, and
opens the same file again successfully.

For the focused upload/export CPU audit, run
`node --import tsx tools/profile-save-pipeline.mts /tmp/save-pipeline.json`
separately from tests/builds. It warms each probe and records three samples on
the committed public save. See [the pipeline audit](../tools/save-pipeline.md)
for the current-main baseline, stage costs, parser findings and worker limits.
