# Independent follow-up audit: domain fields and Undo gestures

> Historical snapshot. See [current V2 status](v2-status.md) and the
> [cleanup audit](v2-cleanup-audit.md) for completed work and remaining follow-ups.

This review compares `v2-domain-fields` with its parent `v2-character-skills`
(commit `9a1d09a`) against the systemic concerns in
[the original engineering audit](v2-code-quality-audit.md). Two independent agents
reviewed the UI/domain and history/runtime changes after implementation; neither
authored them. The assessment includes recurring design concerns, not only merge
blockers. XML parsing and raw save type replacement were deliberately excluded at
the owner's request.

## Outcome

The targeted refactor meaningfully reduces duplication and UI/save coupling; it
does not merely move the same per-input machinery into different components.
No material correctness finding remains after the fixes below. This is not a
claim that every concern in #194 is finished.

| Original concern                                        | Result in this slice                                                                                         | Remaining boundary                                                                              |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| UI constructs transactions and repeats domain knowledge | Character/Farm consume captured domain field adapters; Character branches/prerequisites are domain-owned     | Inventory property controls still await migration                                               |
| Repeated pending/blank/error/request machinery          | One shared controller and native-backed text/number/checkbox/select controls; old Character controls deleted | Existing Inventory controls retain their earlier implementation                                 |
| Independent edits have inconsistent policy              | Character/Farm apply valid values immediately; typing is grouped into Undo gestures                          | Inventory's existing per-keystroke Undo behavior is a migration gap, not another desired policy |
| Selection is page-local                                 | Shared stable farmer identity, with a domain-owned selection field and visible rejection feedback            | Selection choices currently derive from the Character projection                                |
| History concerns are tangled                            | One generic net-state grouping helper; inputs never construct patches/group keys                             | Inventory record/identity transition duplication is unchanged                                   |
| Effect/error handling is inconsistent                   | New field adapters preserve typed command failure/defect/cancellation boundaries                             | Older action/program protocol differences remain                                                |
| Casts/raw save types are awkward                        | UI operates on editor-owned values and fields; no parser/raw type redesign                                   | Broader raw boundary replacement remains separately planned                                     |

Character and Farm markup now imports field adapters and shared controls, with no
`setCharacter`/`setFarmSettings` transaction construction or bespoke async input
state. The former 112-line Character numeric control and 102-line profession
control were removed. This is a concrete removal of duplicate behavior, although
line counts alone are not the quality judgment.

## Findings fixed during the independent review

1. **Selection failure was silently ignored.** The initial shared selector used a
   void callback, could offer ambiguous identities, and could display a selection
   that the model rejected. It now uses the same portable field/select controller,
   omits ambiguous/missing identities with an explanation, and displays typed
   rejection feedback with rollback. Valid farmers with unsupported inventories
   are not excluded merely because their backpack is malformed.
2. **Field identity did not include the file session.** Reusing a component with
   the same field key in another session could retain its old captured commit.
   Descriptors now carry a stable opaque scope symbol as well as a key. Symbols
   also avoid identity changes introduced by reactive wrapping of object tokens.
3. **Old errors survived authoritative changes.** The shared controller now clears
   obsolete rejection feedback when Undo supplies another committed value, while
   unrelated revisions do not clear an error for the same value.
4. **A different field's rejection/no-op did not establish a boundary.** History
   now closes a mismatching group before preparing the new field, even when that
   attempt rejects or changes nothing. Same-field rejection still permits
   correction within the current gesture.
5. **Lower-level concurrent operations could retain the wrong baseline.** A
   suspended standalone action could retry after another grouped edit and carry
   that group's baseline into its published state. History now re-establishes
   boundaries against the current state inside every transaction attempt. A
   Deferred-based regression verifies all four entries survive and Undo restores
   the standalone value.
6. **The new contract had avoidable ambiguity.** Field descriptors are documented
   as snapshots with captured commands, not live proxies. Scope/key define their
   identity. Select options have one authoritative owner, and an unused public
   arbitrary-ID profession map was removed.

These fixes are supported by focused regressions; the audit did not introduce a
new general form, entity, or raw-schema framework to solve them.

## Remaining systemic concerns

### Constraints and field binding

Schema bounds and descriptor constraints still have parallel definitions, such as
Character XP/mastery limits and Farm profit limits. Domain validation remains the
authority, so this is a maintenance/drift risk rather than authorization bypass.
Share the underlying policy constants or metadata before adding many more fields.

The Character and Farm adapters repeat a small begin/commit/end binding pattern
and accept the whole `EditorModel`. A narrow edit-command port and thin binder
would reduce that dependency as more domains adopt the contract. Avoid replacing
this small pattern with a configurable form framework. The shared controller and
presentation controls should remain independent of the save session implementation.

### History ownership and cost

Grouping reduces retained Undo entries, not the number of atomic writes, document
clones, projections or baseline diffs per keystroke. Active gestures retain their
starting document/history outside the serialized history-entry byte budget.
Metadata-only group closure also updates the subscription ref, whose stream clones
the visible state before the model discards an unchanged revision. Large-save
profiling and an explicit ownership/clone budget remain necessary; no typing-speed
or total-heap improvement is claimed here.

The model queue closes gestures for session-only commands such as selection and
export. History independently enforces authoritative boundaries for lower-level
and concurrent callers. That division is necessary, but should stay documented
and tested instead of becoming two unrelated policy implementations.

The original inventory transition/identity duplication and older action/program
error classification remain #194 work. This change adds grouping, not a replacement
inventory engine.

### Domain views and selection

Shared farmer selection currently obtains valid choices through Character's
projection and `readCharacters`. A small shared farmer-choice projection would
make session selection independent of any one feature. This can be done without
redesigning the XML parser or raw types.

The adapters deliberately rebuild snapshot descriptors from published domain
views. Their opaque scope and key must remain stable for the same command target
and meaning. Consumers should not mistake a retained descriptor's `.value` for a
live getter; submitted commands still resolve against current authoritative data.

## Verification

The final application suite passes 823 tests across 80 files. Retained experiments
pass 11 native Node tests and 87 Vitest tests. Types, Svelte checks, Effect
diagnostics, production build, formatting and UI detection pass.

The independent reviewers separately ran 14 controller/domain/Character tests and
10 history/grouping tests. Chrome verified required text replacement, character-by-
character typing, export of the latest value without a prior blur, single-step
Undo/Redo, numeric grouping and cross-field boundaries, XP level mirrors, shared
farmer selection with pending old-target edits, and actual 390px mobile layout
without horizontal overflow. The download check exercised the browser-download
fallback rather than opening the native file picker.

No further feature migration was started as part of this audit. The coherent next
step is incremental adoption of these domain/field boundaries, with the residual
items above retained explicitly in #194.
