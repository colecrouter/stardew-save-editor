# V2 engineering quality audit

> Historical snapshot. See [current V2 status](v2-status.md) and the
> [cleanup audit](v2-cleanup-audit.md) for completed work and remaining follow-ups.

Reviewed 2026-10-28 at Character feature commit `773be79`. This supplements the
[coverage and correctness audit](v2-code-audit.md); it asks what will become
expensive, inconsistent, or difficult to reason about as migration continues.
Three independent reviewers examined runtime/Effect design, UI composition, and
organization/types/tests. This pass is read-only with respect to application code.

Priorities below describe refactoring value, not bug severity or merge blockers.
The report deliberately groups recurring concerns rather than listing isolated
formatting or naming nits. Generated data, dependencies, and the pulled game source
are excluded from application ownership.

## Assessment

The preservation tests, explicit resource ownership, and explanatory comments are
valuable foundations. The growing maintenance cost is in **parallel representations
and duplicated coordination**: the same transition, input lifecycle, or raw-data
policy often has to be understood in several places before it can be changed.
Passing tests does not resolve that design debt.

| Priority    | Systemic concern                                                                  | Desired boundary                                                          |
| ----------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| High        | Immediate editing state machines and ordinary controls are repeatedly implemented | Shared editing behavior plus session-independent presentation controls    |
| High        | Inventory record changes and identity changes describe the same transition twice  | One prepared inventory transition published by history                    |
| High        | Two operation paths use different Effect/error conventions                        | One documented command/publication and failure policy                     |
| High        | Preserved raw XML and validated domain data have an unclear type boundary         | Raw records plus checked feature lenses and narrow adapters               |
| Medium/high | Inventory UI mixes several controllers with rendering                             | Composable selection, drag, display and grid responsibilities             |
| Medium      | Editing policies and control feedback differ across surfaces                      | Explicit interaction policy and consistent shared mechanics               |
| Medium      | Representation, identity and equality policies recur in different forms           | Shared semantics where they are actually the same                         |
| Medium      | The entire view is projected and distributed as one aggregate                     | Feature projections/subscriptions with measured invalidation              |
| Medium      | Experiment-era names and dependency direction obscure current ownership           | Inventory vocabulary and separated request/internal action contracts      |
| Medium      | Metadata, test setup and architecture documentation drift independently           | Pure shared rules, focused harnesses, one current conventions entry point |

## 1. Shared editing behavior is missing, despite several partial control abstractions

The latest-request counter, optimistic pending value, local blank state, expected
error handling, and completion ownership appear independently in:

- [CharacterNumberField](../src/lib/editor/ui/CharacterNumberField.svelte#L23),
- [ItemPropertyControl](../src/lib/editor/ui/ItemPropertyControl.svelte#L26),
- [BackpackItemEditor](../src/lib/editor/ui/BackpackItemEditor.svelte#L38), and
- [CharacterProfession](../src/lib/editor/ui/CharacterProfession.svelte#L25).

This is behavior duplication, not merely repeated markup. The previous audit
already demonstrated drift: Character's stale validation feedback was fixed,
while equivalent inventory controls retain it. Every new field must currently
relearn request ordering, rejection rollback, blank handling, and focus behavior.

Ordinary input styling, labels, bounds, pending/error accessibility and focus
styles are also repeated by these controls and
[FarmPanel](../src/lib/editor/ui/FarmPanel.svelte#L91). Existing legacy `UiInput`
components and the draft `field` adapters do not establish a coherent production
control set.

**Recommendation:** Extract a small immediate-edit controller with a tested
lifecycle, then use presentation-only number/text/select/checkbox primitives for
consistent markup and states. Bind domain commands through thin feature adapters.
Keep calendar's explicit coordinated draft separate. Do not turn every field into
a schema-driven form generator, or require a save session/Effect service just to
render a number input.

**Verification:** Test latest-request ownership, blank replacement, rejected input
followed by the committed value, Undo during editing, target replacement and
component teardown once at the shared boundary. Retain a few full-save integration
tests per feature.

## 2. Inventory transition semantics are duplicated inside history

[domain.ts](../src/lib/editor/domain.ts#L174) and
[equipment.ts](../src/lib/editor/equipment.ts#L128) update inventory records.
[history.ts](../src/lib/editor/history.ts#L414) captures inventory state and then
[reinterprets the actions](../src/lib/editor/history.ts#L520) to exchange handles,
reconstruct slot changes, detect self-drops and compact chest identities.

Those are two implementations of one transition. A future storage behavior must
be changed correctly in both. The comments explain why the bookkeeping exists,
but readers still need to mentally execute both paths to establish agreement.
The chest work's same-owner and self-drop fixes illustrate the synchronization
burden.

**Recommendation:** Prepare one inventory transition containing record changes
and an explicit identity permutation/replacement plan. History should validate,
publish and retain the result; it should not implement chest serialization or
reconstruct equipment swaps. Move a single operation family first rather than
rewriting the engine wholesale.

**Verification:** Preserve exact-document Undo/Redo, byte-identical instances,
opaque/nil records, owner transfers, imported overflow, self-drops and failed
compound operations. The point is to reduce duplicate meaning while retaining
these guarantees.

## 3. Effect's boundary and failure policy vary by operation path

The action path in [operations.ts](../src/lib/editor/operations.ts#L25) converts
arbitrary exceptions to `MutationError`.
[history.execute](../src/lib/editor/history.ts#L620) also converts defects into
expected mutation failures. Typed transaction operations instead deliberately
preserve unexpected defects, for example
[calendar preparation](../src/lib/editor/calendar-operations.ts#L90), so the shared
application boundary can report them with their cause.

This is not just syntax preference: the same programmer error can become an
ordinary field error or a defect notification depending on which protocol the
feature uses. Inventory lifecycle/movement use resolved actions, while farm,
Character and item fields use typed transaction programs. Both meet in the same
history layer, but feature authors must know two different extension paths.

**Recommendation:** Define one expected-failure/defect/cancellation policy and
apply it to both paths. Decide whether actions remain an internal prepared plan or
an externally supported operation protocol. Preserve genuine expected rejections;
do not catch every exception simply to make the error type smaller.

Effect is useful for file lifetime, services, transactions, cancellation, bounded
trinket work and typed command failures. The concern is inconsistent use of those
contracts, not insufficient numbers of `Effect.gen` calls. Keep deterministic
thresholds, color arithmetic, metadata and pure transition planning usable without
an Effect environment. Conversely, extracting more ad hoc Promise machinery would
not improve the existing resource and error boundaries.

## 4. The raw-data type boundary produces recurring casts and local revalidation

[SaveDocument/Farmer](../src/lib/editor/domain.ts#L35) promise valid identifiers,
names and backpack arrays, while the application intentionally accepts malformed
or opaque imported feature data. The codec validates a
[minimum envelope](../src/lib/editor/save-service.ts#L78), not every generated save
field.

Some domains assert the entire generated `Save` type:
[farm](../src/lib/editor/farm-operations.ts#L42),
[calendar](../src/lib/editor/calendar-operations.ts#L90), and
[the aggregate projector](../src/lib/editor/editor-model.ts#L101).
Others build hand-checked open-record lenses:
[Character](../src/lib/editor/character-operations.ts#L130),
[chests](../src/lib/editor/chest-storage.ts#L139), and
[inventory owners](../src/lib/editor/inventory-containers.ts#L17).
Legacy metadata integration adds `as never`/whole-item assertions in
[inventory operations](../src/lib/editor/inventory-operations.ts#L500),
[panel display](../src/lib/editor/ui/BackpackPanel.svelte#L235), and
[sprite display](../src/lib/editor/ui/BackpackItemVisual.svelte#L23).

**Recommendation:** Distinguish preserved raw data from checked feature targets.
Provide small checked facets and narrow legacy adapters rather than asserting the
whole document is valid or repeating shape checks everywhere. Unknown fields must
remain attached; this is not a proposal to normalize imports into a closed schema.

Do not count all casts as equivalent. `as const`, bounded DOM narrowing and a
localized JSON-library adapter can be justified. Repeated `as unknown as Save`,
`as never`, and non-null assertions that conceal missing domain relationships are
the patterns to contain. Prefer one documented unsafe adapter over many optimistic
casts spread across UI and domain code.

## 5. Inventory UI composition has fallen behind its responsibilities

[BackpackPanel](../src/lib/editor/ui/BackpackPanel.svelte) is 967 lines at this
revision. Length is evidence of scope, not the problem itself. It owns selection
and replacement lineage, owner discovery, metadata resolution and capability
policy, native drag/drop, touch capture and edge scrolling, focus restoration,
farmer/chest navigation, catalog actions, grids, inspector layout and styling.

For example, [selection effects](../src/lib/editor/ui/BackpackPanel.svelte#L198),
[display policy](../src/lib/editor/ui/BackpackPanel.svelte#L230), and
[drag entry points](../src/lib/editor/ui/BackpackPanel.svelte#L259) share one closure.
Sprite metadata lookup is separately repeated in `BackpackItemVisual`.

**Recommendation:** Extract selection/replacement-lineage behavior and drag-session
behavior into feature-local controllers, plus a slot/grid presentation component
and one tolerant metadata adapter. Keep the panel as composition and routing.
Controllers should expose meaningful operations rather than export every mutable
variable. Avoid converting unrelated state into a universal global store.

Keep the explanatory comments. Readability improves when each module has a clear
narrative, not when comments are deleted while the same cross-cutting closure
remains.

## 6. Interaction differences need a deliberate policy rather than accidental variants

[FarmPanel](../src/lib/editor/ui/FarmPanel.svelte#L34) uses a per-field busy guard,
local strings, blur/Enter commits and disabled controls. Character and inventory
use immediate valid-input commits, latest-request ownership and retained focus.
Farm checkbox/select handlers also manually restore DOM values after awaiting a
command, unlike the getter/setter binding pattern in newer controls.

The older store-based draft in [field.ts](../src/lib/editor/field.ts#L26) and the
rune-based draft in [field.svelte.ts](../src/lib/editor/field.svelte.ts#L12) also repeat
conflict/pending transition policy. Either share that pure policy or make the
retained comparison implementation's lifecycle explicit.

Calendar's explicit coordinated draft is a justified difference. The issue is
that ordinary independent fields have no equally clear shared policy, so behavior
is inferred from whichever screen was implemented most recently.

**Recommendation:** Document which interactions are immediate, which commit on a
field boundary, and which require explicit confirmation because of coordinated
consequences. Then use shared mechanics within each category. Do not silently
change reviewed behavior merely to make all screens identical.

## 7. Preservation and identity rules are copied as small, drifting conventions

Plain-record predicates alone are not worth a refactoring project. More meaningful
policies recur alongside them:

- Farmer identifier shape and ambiguity checks in
  [inventory views](../src/lib/editor/inventory-operations.ts#L153),
  [container resolution](../src/lib/editor/inventory-containers.ts#L27), and
  [Character](../src/lib/editor/character-operations.ts#L141).
- Nil/empty interpretation in [domain](../src/lib/editor/domain.ts#L131) and
  [chest storage](../src/lib/editor/chest-storage.ts#L31).
- Structural equality in [domain](../src/lib/editor/domain.ts#L13), versus JSON
  string comparisons in [inventory authorization](../src/lib/editor/inventory-operations.ts#L458),
  [history](../src/lib/editor/history.ts#L236), and
  [calendar no-op checks](../src/lib/editor/calendar-operations.ts#L129).

Strict request decoding is another repeated convention: own-field copying,
excess-field rejection, issue formatting and typed-error construction recur in
[farm settings](../src/lib/editor/farm-settings.ts#L51),
[item properties](../src/lib/editor/item-properties.ts#L88),
[Character](../src/lib/editor/character-operations.ts#L108), and
[inventory fields](../src/lib/editor/inventory-operations.ts#L92). A small decoder
constructor taking a local schema and error factory could keep this important
boundary consistent without inventing a domain framework.

**Recommendation:** Consolidate the shared identity and preservation semantics,
not every three-line helper. Decide whether comparisons care about key order,
absence, explicit nils and representation. Keep domain-specific rules for compact
chest storage and opaque empty markers explicit; a single generic helper should
not erase legitimate differences.

## 8. Aggregate projections couple unrelated features and hide work per keystroke

Every published revision rebuilds [the aggregate view](../src/lib/editor/editor-model.ts#L143):
calendar, farm, backpacks, chests, Character, journal summaries and the baseline
JSON patch. Panels subscribe to that aggregate rather than a narrow feature view.
History also clones snapshots and change-stream values for isolation. Additional
clones occur at [draft creation/read/replacement](../src/lib/editor/transaction-draft.ts#L26),
[finalization](../src/lib/editor/history.ts#L225), and
[inventory authorization replay](../src/lib/editor/inventory-operations.ts#L423).
Document a clone/ownership budget before deciding which copies are redundant.

These are defensible preservation boundaries, but they make a cheap Character
keystroke potentially perform inventory/chest projection and a whole-save diff.
Lazy mounting the inventory panel does not make its aggregate read projection
lazy. This is a composition concern even before a measurable performance failure.

**Recommendation:** Measure representative large saves, then separate expensive
feature selectors/derived projections and the review diff from ordinary field
updates. Keep a single authoritative session and atomic revisions. Do not remove
cloning indiscriminately or invent fragile invalidation caches without proving
which data each selector depends on.

## 9. Names and module direction still describe the initial experiment

`BackpackView` and `farmerId` now also represent chests;
[move requests](../src/lib/editor/backpack-movement.ts#L16) use `"backpack"` for
numbered container locations. The [Mutation union](../src/lib/editor/domain.ts#L55)
mixes identity-bearing external requests, resolved positional actions, direct
save mutations and a proof-only bundle operation. `domain.ts` imports runtime
equipment behavior while `equipment.ts` imports domain values back.

**Recommendation:** After clarifying transition ownership, adopt inventory-owner
and container vocabulary, distinguish external requests from prepared internal
actions, and move basic preservation types/errors out of the dispatcher module.
Break the runtime cycle through clearer ownership, not a broad barrel module.
Avoid a mechanical rename first that leaves the same ambiguous contracts intact.

## 10. Shared rules, test setup and current guidance have separate sources of truth

Skill thresholds and profession structure exist in both
[legacy Skills](../src/lib/proxies/Skills.svelte.ts) and
[v2 Character operations](../src/lib/editor/character-operations.ts#L9).
The pure color helpers already demonstrate a useful shared-rule boundary. Pure
metadata need not import a runtime operation module just to be consumed by UI.

Full-save parse/mutate/open/render/dispose scaffolding repeats in
[Character tests](../tests/editor/character.svelte.test.ts#L10),
[item-property tests](../tests/editor/item-properties.svelte.test.ts#L16), and
[chest tests](../tests/editor/chest-inventory.svelte.test.ts#L10).
Extract fixture construction and lifetime plumbing, while keeping exact expected
save assertions visible in individual tests. A generic scenario framework would
hide the preservation intent and is not recommended.

Documentation has a similar organizational problem:
[v2 implementation requirements](v2-implementation.md#L66) still prescribe explicit
stack drafts, while [the active migration guide](v2-backpack-migration.md#L10)
documents immediate edits. This is broader than a stale sentence: new work can
follow a superseded pattern while believing it follows project requirements.

**Recommendation:** Share genuinely identical pure rules; add a small reusable test
harness; establish one current architecture/conventions entry point. Label old
proof requirements as historical and link their replacements. Record deliberate
exceptions instead of leaving contradictory instructions equally authoritative.

## Suggested refactoring sequence

1. Agree on current editing, command-error, raw-data and ownership conventions.
2. Extract immediate-field behavior and presentation primitives; move the existing
   stale-error regressions into shared tests and adopt the primitives incrementally.
3. Unify prepared inventory record/identity transitions; simplify history, then
   correct inventory vocabulary and separate request/internal-action types.
4. Introduce checked feature facets and legacy metadata adapters; consolidate only
   the identity/representation policies whose semantics match.
5. Split inventory selection, drag and display composition; profile large-save
   projections before deciding on selector/invalidation changes.
6. Share pure metadata, reduce repeated test plumbing, and mark obsolete proof
   documentation clearly.

This is a refactoring plan for discussion. Application code was not changed by
this audit. The goal is fewer concepts to reconcile when adding a feature, not a
maximum number of abstractions, components, or Effect services.
