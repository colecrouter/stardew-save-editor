# V2 code inventory and audit — 2026-10-28

This review follows the Character skills/professions/mastery slice on
`v2-character-skills`, based on integrated v2 commit `68c0e07`. Feature work is
paused after that slice. Two independent agents reviewed the actual source: one
mapped migration coverage, and one examined correctness and architecture. Neither
authored the feature. Generated assets and the separately pulled decompiled game
repository are reference inputs, not application code covered by this inventory.

For the broader assessment of recurring code smells, duplication, Effect usage,
UI reuse, types and organization, see the
[engineering quality audit](v2-code-quality-audit.md). The findings below are the
original coverage/correctness scope, not the complete quality assessment.

## Coverage inventory

The inspected tree contains 43 application editor files, 28 editor test files,
and 14 legacy editing page routes. Production v2 exposes five sections:
Inventory, Character, Farm settings, Date and weather, and Review changes.
The presence of an experiment or prototype is not counted as production coverage.

| Surface           | Status          | Implemented coverage and remaining boundary                                                                                                                                                                         |
| ----------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Farm/calendar     | Supported slice | Farm name, profit margin, monsters, mine rewards, date/weather and coordinated consequences. Creation settings remain explanatory/read-only.                                                                        |
| Inventory         | Partial         | Actual backpack arrays, equipment validation, catalog, item properties, direct transfers and Undo. Sorting and specialized catalog constructors remain outside coverage.                                            |
| Chests            | Partial         | Placed chests including building interiors, container search, item editing and transfers. No fridges, machine/building-output/shared storage, type changes, sorting, bulk/group actions or cross-chest item search. |
| Character         | Partial         | Five skills' XP/levels, professions and Mastery XP. Stats/currencies, wallet unlocks, backpack/house/trash-can/tool upgrades remain legacy-only.                                                                    |
| Bundles           | Proof only      | Spring Foraging completion is behind `includeProofs`; general bundles and Joja UI are not production features.                                                                                                      |
| Appearance        | Missing         | Identity/appearance fields and live character preview. Farm name exists separately.                                                                                                                                 |
| Relationships     | Missing         | Friendship editing and adding missing villagers.                                                                                                                                                                    |
| Events            | Missing         | Known/custom event ID editing.                                                                                                                                                                                      |
| Farmhands         | Missing         | Profile reassignment/reordering; selecting existing farmers is supported in Inventory and Character.                                                                                                                |
| Cooking/crafting  | Missing         | Recipe unlocks and counts.                                                                                                                                                                                          |
| Quests/Qi quests  | Missing         | Quest logs, special orders and their completion transitions.                                                                                                                                                        |
| Buildings/animals | Missing         | Building repair/tier changes and animal management.                                                                                                                                                                 |

Sources: [production navigation](../src/lib/editor/ui/EditorWorkspace.svelte),
[Character controls](../src/lib/editor/ui/CharacterPanel.svelte),
[placed chest discovery](../src/lib/editor/chest-storage.ts),
[bundle prototype](../src/lib/editor/ui/BundlePanel.svelte), and the actual pages
under `src/routes/(legacy)/(edit)`. Stack splitting and merging are explicitly
deferred by product decision and are not release blockers.

## Ownership and retained comparisons

- `editor-model.ts` owns the file scope, UI command queue, subscriptions, defect
  notifications and export.
- `history.ts` owns atomic publication, session identities and bounded Undo/Redo.
- Domain operation modules own save-format rules; UI controls submit commands.
- `save-service.ts` uses the shared XML codec, keeps complete parsed records,
  checks the supported envelope/version, and reparses/validates exports.
- Twelve top-level experiment TypeScript files forward application exports;
  seven experiment Svelte wrappers import application UI. They are retained
  comparisons/harnesses rather than a second implementation. The lab explicitly
  enables proofs and disables export validation. Retire forwarding paths when
  their consumers and comparisons are deliberately retired.

## Findings

The independent correctness review found a validation-feedback defect in the new
numeric control: after rejecting an edit, re-entering the already committed valid
value left its old error visible. This was reproduced in Chrome, fixed by clearing
feedback before the no-op return, and covered by a regression that also checks no
new saved change is created.

No remaining data-integrity or architecture blocker was found. The correctness
review covered command serialization, scope teardown, import generations, export
validation, exact Undo/Redo, identity compaction, inventory authorization, farmer
targeting, and mastery preservation. This is a bounded source review and targeted
verification, not a claim that every supported save or legacy workflow was tested.

A **P2 validation-feedback follow-up** remains in the existing inventory controls:
[BackpackItemEditor](../src/lib/editor/ui/BackpackItemEditor.svelte) and
[ItemPropertyControl](../src/lib/editor/ui/ItemPropertyControl.svelte) have the same
rejected-input → re-enter-committed-value stale-error behavior. Chrome reproduced
it for quantity and base price. Clear feedback before their same-value early
returns and add equivalent regressions. Saved data is unaffected; this was recorded
rather than expanding the Character patch during the audit.

Two maintenance issues remain visible for a cleanup pass:

- [EditorApp](../src/lib/editor/ui/EditorApp.svelte) describes the older
  quantity/quality, farm and calendar slice, omitting equipment, chests, item
  properties and Character.
- [The experiment README](../experiments/v2/README.md) still says Effect is outside
  the production dependency graph, despite the application-owned runtime.

Skill thresholds/profession metadata currently exist in both the legacy proxy
module and the v2 operation module. This is intentional migration duplication;
shared pure metadata is a possible cleanup, not a second runtime implementation.

## Verification and release gates

The final application suite passes 802 tests across 77 files. The retained
experiments pass 11 native Node tests and 87 Vitest tests. Application types,
Svelte checks, Effect diagnostics, production build, formatting and UI detection
passed. The independent correctness reviewer separately ran the 15 Character
domain/UI tests. Chrome verified XP/level synchronization, profession cascade and
Undo, mastery validation, pending-edit farmer targeting, and desktop/390px phone
layouts without horizontal overflow.

Large-save typing/render profiling remains a release gate. Whole-document cloning
and projections have explicit boundaries, and Undo history has byte limits, but
those limits do not establish total heap bounds. Added inventory/chest projections
should be included in that profiling before claiming release readiness.

## Planning boundary

Before another feature, agree on the bounded v2 release coverage. This is not yet
a complete replacement for all fourteen legacy pages. Completing Character
stats/unlocks is a coherent next slice; relationships and general bundles remain
substantial user-facing migrations. Inventory sorting and broader storage are
parity gaps, independently of the intentionally deferred stack interactions.

The legacy path should remain available until its supported interactions and
preservation cases are covered by the replacement. No feature work beyond the
Character slice was started during this audit.
