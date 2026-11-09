# Tests

- `npm test`: application/domain/component and retained legacy regressions (Vitest,
  happy-dom). Files named `e2e` here are integration tests, not real-browser tests.
- `npm run test:editor`: the narrower application editor suite.
- `npm ci --prefix tests/engine`, then `npm test --prefix tests/engine`: engine
  contracts plus native Node import/codec checks. This package uses Vitest 5 because
  the Effect test adapter requires it; the application runner remains Vitest 3. The Node platform shared package is pinned
  to the tested 4.0.6 API alongside Effect.
- `npm run check --prefix tests/engine` and `npm run effect:diagnostics --prefix tests/engine`:
  standalone engine typing and Effect diagnostics.

Shared fixture builders live in `tests/helpers/editor-document.ts`; Vite and Node
retain separate public-save loaders. `tests/editor/workspace.ts` owns common
workspace setup and unmount-before-file-close cleanup. Keep feature assertions and
special cancellation/lifetime setup explicit. Use small fixtures for rule tests;
retain full-save cases for preservation. Never commit private user saves.

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
