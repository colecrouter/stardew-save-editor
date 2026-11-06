# Final V2 cutover audit

This is the 2026-11-05 checkpoint after the owner-approved contribution reconciliation
(#254–#256), based on V2 commit `52dcb1b` plus this cleanup. It does not replace
feature preservation tests or claim that every possible save/mod combination was
exercised. Default-route changes and legacy retirement remain #220; the V2 release
milestone contains stretch work rather than prerequisites for this baseline.

## Independent review scope

Three separate reviewers inspected the complete V2 implementation, rather than
only this cleanup diff. Each read the repository conventions and worked without
editing source or delegating further reviews:

- Domain/history: engine publication, immutable snapshots, transaction capabilities,
  feature adapters, inventory metadata and preservation tests.
- Effect/runtime: file scopes, queues, Atom ownership, cancellation, typed errors,
  import/export/backup boundaries and failure-path coverage.
- UI/composition: domain field adapters, gesture/draft lifecycles, shared Study kit,
  native control rejection, accessibility associations, duplication and organization.

The parent reviewed the findings, implemented fixes and ran validation. An
independent follow-up checked the error-boundary implementation. These are targeted
source reviews, not a claim of exhaustive line-by-line or device coverage.

## Findings resolved in this cleanup

| Finding                                                                                                 | Change and regression evidence                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| An opaque Qi `questKey` could throw during projection through `String(...)`.                            | Use the existing checked key reader. `qi-orders.test.ts` retains an object with an opaque `toString` member unchanged.                                                                                                                                                                                                                  |
| Relationship insertion accepted XML-nil dictionaries and retained a contradictory nil marker.           | Reject boolean/string nil containers. `relationship-operations.test.ts` verifies unchanged document and history on refusal.                                                                                                                                                                                                             |
| Native weather selectors could display a choice rejected by the command.                                | Restore the latest committed selection on typed failure or noncompletion. `calendar-visual.svelte.test.ts` exercises both paths.                                                                                                                                                                                                        |
| Draft parsing threw ordinary errors and controllers rendered arbitrary caught exceptions as validation. | Typed `FieldValidationError` Effects distinguish invalid input from defects. Both controllers share one submission boundary; captured commits retain their file scope/queue. `draft.svelte.test.ts` covers parser, commit and completion-formatting defects, reporting once and retry. Existing date/conflict/replacement tests remain. |
| Automatic backup creation classified every rejected writer as an ordinary archive warning.              | Reuse the backup Effect boundary and classify browser DOMExceptions separately from defects. `backups.svelte.test.ts` covers both outcomes without blocking the opened save.                                                                                                                                                            |
| A terminal observer failure bypassed the model's shared reporting.                                      | Commands and observer share Cause reporting. An observer defect explicitly asks to reopen the save, without blindly retrying bad projection code. `publication-stream.test.ts` injects a lower-level publication defect and verifies one notice/report and ordinary teardown.                                                           |

No P0/P1 finding was established. The P2 findings above were fixed rather than
being deferred under the label of cleanup. Promise adapters that preserve an
existing file-owned command queue are deliberate; no new long-lived field runtime
or generic domain framework was introduced.

## Remaining systemic opportunities

These are P3 consolidation opportunities for #228, not unresolved demonstrated
correctness defects:

- Immediate field components repeat feedback precedence, `aria-describedby`
  assembly and wrapper markup. A small editor-field shell could share that policy
  while keeping each native input and controller binding explicit.
- Saved-boundary scalar ID and nil checks recur in feature adapters, with some
  deliberately stronger operation rules. Share only established narrow primitives
  incrementally; keep domain-specific container policies explicit. The nil bug
  above illustrates drift, but does not justify replacing the planned parser work.
- Item presentation and inventory mutation retain two matching legacy metadata
  shape guards and assertions. A dependency-light checked resolver helper could
  prevent future policy divergence while preserving lazy catalog loading.

Existing Inventory/Storage renderer and selection simplifications remain #228.
The parser/raw-type replacement remains #206. Intentional assertions at legacy
metadata, JSON patch and read-only Atom boundaries are not automatically defects.

## Last visual pass

Every V2 search control has a contextual hint while retaining its visible label.
The desktop page gives the frame the space remaining after the actual footer text,
rather than nesting a viewport-sized frame inside more padding. Phones retain
natural document scrolling. The original 32px GitHub shortcut and black corner
ribbon are restored at the upper left, clear of Close.

Production Chromium checks visited all 14 sections at 1440×900, 1024×600,
390×900 and 320×700: 56 section/viewport combinations. Desktop document height
fits the viewport without hiding overflow; all widths avoid horizontal document
overflow; rendered search inputs have hints. Entry and workspace screenshots were
inspected. No application page exception or framework overlay was observed.
This pass uses the established direct Playwright approach; the Browser plugin is
not available. It does not replace earlier owner-accepted VoiceOver, section-menu,
macOS overscroll or mobile download provenance checks.

## Validation results

- Full application suite: 147 files, 1,200 tests passed.
- Experiment suite: 87 Vitest tests and 11 Node tests passed; native type check passed.
- Application lint/native types/Svelte check: passed (zero Svelte errors/warnings).
  Existing nonblocking Biome warnings remain; this is not a zero-warning lint claim.
- Formatting and production build: passed. Existing build notices include missing
  Sentry upload credentials, stale Browserslist data and legacy chunk annotations.
- Application and experiment Effect diagnostics: zero errors, warnings or messages.
- Production Playwright: all 56 section/viewport checks passed again after cleanup.

## Cutover recommendation

Finish this cleanup and its checks, then perform #220's deliberate route/link and
legacy-retirement work. Validate import, edit, Undo/Redo, export and original
backups on the changed default route and document rollback. After owner acceptance,
merge V2 into main. Completing the V2 release stretch milestone is unnecessary
for this already agreed foundation boundary.
