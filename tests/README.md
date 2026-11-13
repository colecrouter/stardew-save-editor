# Tests

- `npm run test:asset-dump`: catalog extraction regressions and filesystem publication/rollback
  for the .NET generator; no game installation or graphics device required.
- `npm test`: application/domain/component and retained legacy regressions (Vite+ Vitest 5,
  Node by default, happy-dom for `*.svelte.test.ts`). Legacy-editor regressions are excluded.
- `npm run test:legacy`: opt-in legacy-editor regressions, including the legacy
  route boundary. CI does not run this command. Files named `e2e` here are
  integration tests, not real-browser tests.
- `npm run test:editor`: the narrower application editor suite.
- `npm run test:game-data`: .NET 10 inspection/generation, generated-module
  type checks, XML codec behavior, and synthetic XmlSerializer interoperability.
  It rebuilds ignored test output; no game installation is required.
- `npm run check:tests`: native TypeScript and Svelte checks for application test
  files and component harnesses.
- `npm test -- tests/engine`: engine contracts, codec preservation, and worker checks
  in the root Vitest Node project, using the shared Effect dependency installation.
- `npm run effect:diagnostics:tests`: Effect diagnostics for all application and
  engine tests; `npm run check:tests` checks their shared TypeScript scope.

Legacy test ownership is listed explicitly in `vite.config.ts`. Add new legacy-only
files there so they stay opt-in; keep shared regression coverage outside that list.
`test:legacy` selects the `legacy-test` Vite mode, with the same setup as default tests.
The editor remains available in the app; this selection only changes test execution.

The app and its shared tests use one npm installation with separate TypeScript
scopes. The root `tsconfig.json` lets editors discover the app, test and tooling
projects while leaving file ownership to those scopes. `tsconfig.app.json` checks browser
application code; `tsconfig.tests.json`
adds the test environment without introducing Node globals into the app scope.
`tsconfig.node.json` covers build and development tooling. Engine tests belong to
`tsconfig.tests.json` alongside the application tests.

The root runner defines `node` and `svelte` projects. Node retains Vitest's default
test discovery, including colocated tests and `.spec.ts` files; Svelte rendering
tests are excluded from Node and selected by their `.svelte.test.ts` suffix. Use `npm test -- --project node`
or `npm test -- --project svelte` to run one environment. DOM event tests that do
not render Svelte may use an explicit `@vitest-environment happy-dom` directive.
Both projects load the decoded fixture baseline; only the Svelte project installs
component cleanup, browser-worker simulation, and Kit page-state mocks.

Shared fixture builders live in `tests/helpers/editor-document.ts`; engine tests
read the public save from disk and share the same decoded baseline. The root
runner decodes the public save once in global setup, writes a temporary V8 snapshot (preserving bigint), and gives
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

Domain tests import `it` from `@effect/vitest` and return an Effect from
`it.effect`, usually with `Effect.gen`. The adapter owns the test scope, interrupts
timed-out fibers and runs finalizers; do not duplicate `runPromise(scoped(...))`
helpers. Keep plain synchronous assertions on ordinary `it`, and use ordinary
async tests when exercising the application's Promise or browser boundary.
`it.effect.each` passes each case as one value (destructure tuple rows), and its
timeout/options argument follows the Effect callback. Test services include a
controlled clock; use `it.live` only when the behavior requires real Effect time.
Import `vi` directly from `vitest` so its hoisted mocks are recognized by Vitest.

`openEditorBlob(processingLayer, blob, ...)` is the browser file-import entry:
its worker opens the Blob stream locally. `openEditor(processingLayer, bytes, ...)`
retains the byte-based API for existing tools and fixtures. Both require an
explicit execution choice.
The app supplies `SaveProcessingBrowser`. Component/unit fixtures and CPU-only
profiling select `SaveProcessingSync`; tests that only need a failure or pending
operation can supply a mock layer. Engine application integration tests select
`SaveProcessingNode` from `tests/helpers/save-processing-node.ts`, exercising real
worker threads with the same RPC client and handlers as the browser. The Node
adapter lives beside these shared helpers and uses the same Effect installation
as the application and engine tests.

Engine comparison executors and store/Atom harnesses are test-only reference
fixtures, not alternate application runtimes. Their assertions remain until
superseded deliberately. Engine tests run in the Vitest Node project; worker
transport tests use real Node worker threads. No coverage percentage is currently measured.

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
