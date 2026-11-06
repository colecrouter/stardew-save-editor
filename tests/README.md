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
