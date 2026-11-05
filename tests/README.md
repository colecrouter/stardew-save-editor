# Test map and ownership

The root `npm test` owns all application tests, including `tests/editor` and shared
UI/legacy regressions. `npm run test:editor` is the narrower V2 command. Both use
Vitest and happy-dom through `vite.config.ts`; a `.svelte.test.ts` suffix enables
Svelte/rune compilation, not a real browser. Files named `e2e` in this directory
are legacy integration tests, not production browser automation.

| Layer                                       | Location / command                                                                                                                       | Purpose and representative evidence                                                                                                                                                             |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Engine, history and transaction contracts   | `experiments/v2/*.effect.ts`; `npm test --prefix experiments/v2`                                                                         | Authoritative production-engine tests still use compatibility imports here: rollback, receipts, identity, history budgets and retention. Keep until deliberately migrated.                      |
| Native Node import/codec boundary           | `experiments/v2/{mutation,calendar}.node.ts`; `npm run test:node --prefix experiments/v2`                                                | Executes without Vite to catch accidental browser-only runtime imports. A happy-dom test is not a replacement.                                                                                  |
| Feature/domain rules                        | `tests/editor/*operations.test.ts` and feature suites                                                                                    | Small explicit saved documents, invalid/opaque inputs, target authority, atomic refusal, exact Undo/Redo and XML representation. Examples: pregnancy, community requirements, inventory replay. |
| Components and workspace integration        | `tests/editor/*.svelte.test.ts`, `tests/ui`                                                                                              | Real fields and domain commands: gesture grouping, stale selection, native-control rejection, keyboard semantics, mounted subscriptions.                                                        |
| Application integration                     | `tests/editor/{workflow,application-lifecycle,export-failure-workflow,backups}.svelte.test.ts`, `application.test.ts`, `session.test.ts` | Import/edit/export, exact full-save preservation, browser failure adapters, pending work and scope disposal. Browser APIs are mocked where necessary.                                           |
| Production browser smoke                    | `tools/smoke-editor-browser.mjs`                                                                                                         | Public fixture import, farm edit, Undo/Redo, desktop native drag, exact export/reimport, all-section viewport/search checks. No timing budgets or device emulation claims.                      |
| Performance and native-device qualification | `tools/qualify-editor-browser.mjs`, `docs/v2-performance-qualification.md`, `docs/v2-foundation-validation.md`                           | Explicit performance workloads and recorded browser/device/accessibility evidence. Owner VoiceOver and mobile-download acceptance remain distinct from CI component coverage.                   |

There is no configured statement/branch coverage provider or threshold. Test
counts and this workflow map describe evidence, not a measured coverage percentage.

## Shared setup

`tests/helpers/editor-document.ts` owns production-codec serialization and common
small document builders. `tests/editor/fixtures.ts` loads the public `TestSave`
through Vite; the experiment loader uses Node filesystem IO. Keep those loaders
separate so native import coverage remains meaningful.

`tests/editor/workspace.ts` mounts a production workspace and releases its UI
before closing the borrowed file registry, including failed setup. Use it where
that setup is actually repeated. `WorkspaceHarness.svelte` renders the whole
workspace; Backpack/Storage harnesses intentionally render narrower surfaces.
Feature fixtures, special teardown/cancellation tests and assertions stay explicit.

Prefer small fixtures for isolated domain rules. Keep the 6.65 MB public save for
selected full-document preservation/integration scenarios. Never substitute a
private user save in committed fixtures or browser evidence. Preserve useful domain
and UI layers even if they exercise the same feature; only redundant orchestration
should be shared.

## Production smoke

Build first and start a production preview in a separate terminal:

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4269
```

Then run with an installed Playwright Chromium (or supply an existing executable):

```sh
node --import tsx tools/smoke-editor-browser.mjs
node --import tsx tools/smoke-editor-browser.mjs --chromium /absolute/path/to/chromium
```

`--url` overrides the full editor URL for a changed base/default route. `--output`
overrides the evidence path (default `/tmp/v2-browser-smoke.json`). The script uses
four viewport sizes, including a short desktop and narrow phones; native dragging
is checked on desktop only. It does not install browsers, start servers, profile
performance or claim native mobile/VoiceOver coverage. Exit is nonzero on failure.
Restart preview after rebuilding so its cached manifests match the new output.

CI's `tests` job runs the root application suite once. The separate experiment job
owns the distinct Node/Effect/lab checks; its `test:ui` alias remains a manual
convenience and is not repeated in CI. Retirement ownership is documented in
[cutover cleanup](../docs/v2-cutover-cleanup.md).
