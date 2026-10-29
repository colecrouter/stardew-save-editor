# Independent V2 cleanup quality audit

Reviewed the cleanup working tree based on `10b0619`, following
[#194's engineering audit](v2-code-quality-audit.md) and the
[domain-field follow-up](v2-domain-fields-audit.md). The reviewer did not author
the application changes. This audit checks recurring maintenance costs as well
as correctness; XML parsing and replacement of the raw save types remain outside
scope at the owner's request.

## Assessment

The cleanup removes important duplicate meanings. Inventory inspectors now use
the same immediate-field lifecycle as Character and Farm. Inventory record and
session-identity transitions have one owner, while history publishes their
prepared result. The production action path preserves expected failures as typed
values and unexpected exceptions as defects. These are meaningful improvements
over moving old coordination into differently named files.

Performance remains a high-priority follow-up, backed by measurements rather
than inferred from file sizes. Inventory panel composition and legacy metadata
adapters remain medium-priority quality work. None of those requires restarting
the domain-view design or expanding this cleanup into a parser rewrite.

| Concern                               | Evidence in this cleanup                                                                                                                                                                                 | Remaining work                                                                                                               |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Repeated input state machines         | `BackpackItemEditor` quantity uses `NumberField`; quality uses the shared controller with discrete choices. `ItemPropertyControl` delegates to shared number, checkbox, color and select controls.       | Keep native color-picker gesture behavior covered in a browser visual pass.                                                  |
| Per-keystroke inventory Undo          | `inventory-domain.ts` captures the instance handle and field key, binds through `bindImmediateField`, and submits through the grouped edit command.                                                      | No separate inventory editing policy is needed.                                                                              |
| Duplicate record/identity transitions | `inventory-transition.ts` moves record/handle pairs, partitions chests once, and owns fresh replacement and capacity identities. History consumes the prepared identity state.                           | Preserve the draft-only mutation contract; these helpers are not safe against published records.                             |
| Action/program error inconsistency    | `applyResult` / `prepareResult` and history finalization return checked Results; production lifts them through `Effect.fromResult`. The previous action-path defect-to-validation conversion is removed. | Plain comparison wrappers remain explicitly historical. Best-effort legacy metadata lookup is a separate tolerance boundary. |
| Repeated field binding                | `field-binding.ts` offers a small edit port and captured-operation binder, now adopted beyond Inventory.                                                                                                 | Avoid turning the port into another full editor model or a general form engine.                                              |
| Selection depends on Character        | `readFarmerChoices` provides an identity/name projection independently of Character fields.                                                                                                              | Feature-specific availability remains distinct from whether an identity is selectable.                                       |
| Large-save editing costs              | `tools/profile-editor.mts` measures the real model/queue path on a public fixture and deterministic synthetic chests.                                                                                    | Aggregate projection and document clone costs remain; see the measured limits below.                                         |

## Correctness finding during review

The first capacity extraction resized records and identities but omitted the
farmer's saved `maxItems`. This was a merge blocker: the save could describe a
different capacity from the visible slot count. The reviewer reported it, and
the implementation owner also reproduced failures in the capacity tests. The
paired resize helper now updates that metadata as part of the same outcome.
The independent final core run includes the capacity regressions.

Dead alternate implementations also matter here. Retaining the old equipment
swap executor and chest identity compactor would leave two competing accounts of
the transition even if only one were called. Those unused implementations and
the former throwing equipment-reader helper have now been removed, leaving the
paired transition as the production owner.

All ordinary field domains now use `bindImmediateField` and narrow editing ports:
Character, Character details, Farm, Inventory, Appearance, Relationships, Recipes,
Events, Quests and Qi orders. Discrete coordinated actions use the narrow
transaction port. Farmer selection has its own narrow selection capability and
shared identity projection. Character/Farm/Inventory limits also share policy
constants between presentation and request validation, addressing the earlier
duplicated-binding and constraint-drift findings.

## Residual systemic findings

### High follow-up: the command path still does substantial whole-save work

`editor-model.ts` assembles every feature projection and the baseline JSON patch
for each document revision. `transaction-draft.ts` separately detaches initial
state, reads and replacements. Grouping reduces retained Undo entries; it does
not reduce how many valid writes enter that path.

The [performance report](v2-performance-profile.md) records final sequential
median latencies of about 162 ms for the public fixture and 295 ms after adding
250 chests. Eight queued edits accumulated approximately 1.3 and 2.3 seconds.
These are instrumented Node measurements, not browser frame timings or universal
budgets. They establish a responsiveness concern worth addressing independently
of a visual polish pass.

Filtering unchanged revisions before stream detachment removes cloning on
metadata-only gesture closure. Bulk detachment of inventory arrays reduces
large-save clone calls per edit from 9,026 to 265 while preserving independent
nested raw records. This copies the same represented item data, so call-count
reduction is not an allocation or heap guarantee. Neither change justifies
claiming feature invalidation or whole-save work solved. The report preserves
baseline/final JSON and matching final source fingerprints.

The final stream filter retains only a revision number per subscriber. An
intermediate comparator retained the last raw history state and thereby an
already-closed gesture's starting document. The final measurements show the
expected heap drop on close again, with zero close-time clones. Checking both
emission cost and retained ownership was necessary to validate this optimization.

Active gestures retain their initial document/history outside the serialized
Undo-entry byte cap. This is deliberate grouping ownership, but the cap must not
be described as a total editor heap bound. The profile distinguishes those
quantities appropriately.

### Medium follow-up: Inventory remains a broad composition closure

`BackpackPanel.svelte` still owns selection lineage, owner navigation, focus
restoration, metadata display, native drag/drop, touch gesture capture,
edge-scrolling, catalog actions and the rendered grids. The extracted property
controls reduce inspector complexity, but do not reduce this panel's controller
responsibilities. Several reactive effects coordinate selection back into the
shared farmer and chest state.

Extract selection/lineage and drag-session behavior into feature-local
controllers, and make the grid/slot presentation consume their operations. Keep
the current keyboard, touch, self-drop and Undo selection tests as the contract.
Do not expose every local variable through a generic store. File length alone
is not the finding; interdependent policies in one closure are.

### Medium follow-up: tolerant metadata resolution and unsafe casts are scattered

`inventory-operations.ts`, `BackpackPanel.svelte`, `BackpackItemVisual.svelte` and
`appearance-preview.ts` each adapt open imported item records into the legacy
item-data API. Casts such as `as never` and `as unknown as Item` recur alongside
different fallbacks. This lets a display assumption or catalog compatibility
change diverge across the inspector, sprite and player preview.

Provide one documented, tolerant legacy metadata adapter returning an
editor-owned result. Missing or unsupported metadata should preserve the raw
record and its ability to move. Keep actual operation validation in the domain.
This adapter is useful even before the planned XML/raw-type replacement.

The mutation-side `metadataFor` lookup now guards malformed lookup inputs
explicitly and leaves unexpected catalog exceptions as defects. A regression
checks both malformed imported IDs and an injected catalog defect without
publishing state. That closes the broad exception-swallowing issue on the edit
path; consolidating the remaining display/preview adapters is still worthwhile.

### Medium follow-up: external requests and prepared actions still share vocabulary

`Mutation` still combines identity-bearing backpack requests, positional internal
inventory actions and retained proof actions. `farmerId` and `BackpackView` also
refer to chests. The paired transition makes the ownership clearer, but feature
authors still need to know which values require authoritative resolution and
which values are already resolved.

Separate request and prepared-action types when adding the next inventory
operation, then adopt container/owner names at that boundary. Avoid a mechanical
repository-wide rename without establishing those meanings.

### Low follow-up: common boundary plumbing and documentation can drift

Strict request decoders repeat own-field copying, excess-field rejection and
issue/error construction across feature operation modules. Full-save test
setup/open/render/dispose code also repeats across UI suites. These are smaller
concerns than transition and editing-policy duplication, but should not grow
unchecked. A thin decoder helper and fixture-lifetime helper would be reasonable;
a generic feature framework would obscure the tests' preservation intent.

The earlier field guide's scope section describes inventory control conversion
and transition ownership as future work. Keep that report as a historical
snapshot, but link the current cleanup from the active guide and #194 so a new
contributor does not repeat completed work. Likewise, retain explicit historical
labels around synchronous comparison executors rather than presenting them as
the production extension path.

## Validation and disposition

The independent reviewer ran 32 tests across `backpack.svelte`,
`chest-inventory.svelte`, `item-properties.svelte` and `edit-gestures` successfully.
They cover rapid input, incomplete values, one-step grouped Undo, rejection
rollback, equipped and stored properties, chest transfers and selection through
Undo. A second independent run passes 64 tests across `inventory-transition`,
`inventory-operations`, `equipment`, `backpack-lifecycle`, `chest-inventory` and
`edit-gestures`, covering final core transitions, capacity, nested preservation
and gestures. The implementation owner's full
suite, build and type checks remain the release gate; focused review runs do not
substitute for those checks.

The capacity regression and obsolete alternate transition implementations are
resolved. No further blocking correctness or architecture finding remains in
this review. Performance/working-set ownership and Inventory composition/metadata
boundaries should continue as explicit follow-up issues. Vocabulary and smaller
plumbing improvements can follow those boundaries incrementally. Reconciling and
closing #194 after this cleanup merges must preserve those follow-ups rather
than claim every concern disappeared because the tests pass.

## Follow-up ownership

Remaining performance work is tracked in [#201](https://github.com/colecrouter/stardew-save-editor/issues/201).
Inventory controller composition and metadata boundaries are tracked in
[#202](https://github.com/colecrouter/stardew-save-editor/issues/202).
See [current V2 status](v2-status.md) for coverage and extension conventions.
