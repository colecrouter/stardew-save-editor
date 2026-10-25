# Editor foundations discovery (#166)

Audit baseline: local commit `6636a34` on 2026-10-24 (local timezone), with calendar
editing now included in the inspected working tree. This document records observed
code paths, required outcomes, and hypotheses. It does not select a UI framework,
Effect, a replacement state model, or a release date.

## Current state and mutation paths

`src/lib/SaveManager.svelte.ts` reads bytes, detects zlib input, parses XML through
a singleton Comlink worker, validates the uploaded data, stores a backup, normalizes
empty farmer containers, disposes the previous imported save root, and constructs
`SaveProxy` in a new root. `reset` disposes that root. Development restoration takes
a different path through `loadDevState`; it constructs a proxy without assigning
`disposeSave`. That ownership difference warrants investigation, not an unmeasured
claim that it currently leaks. Worker lifetime is module/application-wide rather
than explicitly session-owned.

`src/lib/workers/xml.ts` controls array recognition and numeric-looking text,
prunes formatting whitespace, injects equipment type metadata on parse, and strips
that metadata during serialization. `SaveManager.export` serializes a JSON copy of
the proxy's raw document. `validatedExport` reparses the resulting bytes and checks
known constraints; download rejects known invalid results. This is not proof that
all game invariants hold. Export is currently uncompressed even for compressed
input; console/mobile packaging requirements need platform-specific treatment.

`SaveProxy` retains raw data and constructs farmer/location proxies, discovers
chests, and creates bundles, Qi quests, and calendar views. Several collections and
scalars are copied into reactive fields then written back by effects. UI controls
bind directly to those fields (for example farmer money). Raw data is authoritative
for export, while reactive fields or maps are authoritative for some edits until
their synchronization effects run. There is no universal operation boundary or
user-intent record spanning those writes.

Not every edit is effect-driven. `Inventory.set` directly changes raw slots and
disposes replaced factory-owned items; `swap` moves raw entries and proxies without
disposing them. Secret Notes are omitted from its display map but retained in raw
slots. Chest moves explicitly transfer item ownership. `Calendar` uses explicit
setters to coordinate date copies, host days played, weather, and watering effects.
Building upgrades, bundle completion, and quest completion similarly represent
multi-field domain actions. These are promising migration boundaries, not generic
property assignments to wrap blindly.

`Item.create` constructs an independent `$effect.root` and attaches `[Dispose]`.
Inventory initialization instead calls `createItemProxy` under the surrounding
root. Factory-created items can consequently have different ownership from loaded
ones. `NamedItemSprite` explicitly disposes its created item on name change/unmount.
Animal and friendship factories also own roots; nested ownership must be audited.
An outer root does not implicitly adopt independent roots. Convenient APIs remain
acceptable provided ownership and cleanup are reliable.

UI primitives in `src/lib/ui` cover basic buttons, inputs, selects, tooltips and
ranges, while routes own domain layout and substantial local styling. The stated
review pain concerns keyboard/focus behavior, native HTML opportunities, and
repeated bespoke controls. A new library is a hypothesis; it still needs measured
interaction and accessibility acceptance checks in #170.

## Normalization, repairs, and preservation

Construction is not universally read-only: farmer wallet-field migration converts
legacy flags to mail, inventory construction can omit nil equipment markers, and
reactive initialization can write defaults. Parser normalization is another class
of change. These may be intentional compatibility behavior, but review needs to
distinguish them from requested edits and unexpected writes. Define explicit
exceptions before demanding byte-identical saves.

Historical reports #119 (unmet relationships), #110 (combined rings), #87 (remixed
bundles), and #112 (host-switch cellar assignments) demonstrate preservation and
coordinated-state risks. Closed reports are evidence of failure patterns, not a
claim those bugs remain. Issue #61 is still open but its comments describe a fix;
its open status alone is not evidence of a current defect.

## Required outcomes

1. **Preservation:** opening/viewing a save and editing a narrow field must preserve
   unrelated supported and opaque data, except explicitly documented normalization
   or repairs. Compare parsed semantics and domain invariants; retain raw bytes as
   a recovery baseline. Preserve numeric-looking user text and large IDs as parsed.
2. **Intent and completeness:** record the target and meaning of a requested edit,
   with actual coordinated changes. Quiet/compact operations may use less review
   space but must remain inspectable. Compare exported data against the baseline
   to detect changes outside recorded operations. History and final net differences
   answer different questions.
3. **Atomicity:** failed validation or preparation must not leave partially changed
   save data or a successful receipt. Define publication and async/cancellation
   behavior, including when pending edits may be exported.
4. **Targeting:** resolve stable farmer identity at execution time rather than rely
   on current sidebar selection. Distinguish shared state from farmer-owned fields,
   including shared money. Reject ambiguous/missing targets. Item identity after
   moves requires a separate design.
5. **Memory safety:** repeated item creation/replacement, view changes, and session
   replacement/closure must release owned roots/subscriptions/workers according to
   their intended lifetime. No requirement bans display proxies or a constructor.
6. **Accessible interactions:** supported controls work with keyboard and touch,
   have accessible names and visible focus, and manage dialog/menu focus correctly.
   Share conventions where they reduce recurring defects.
7. **Responsiveness:** preserve asynchronous parsing and test interaction/export on
   representative desktop and mobile saves. Avoid whole-document work on every
   keystroke without measurement. Establish budgets from observed baselines rather
   than inventing thresholds before profiling.

## Scenarios and baseline evidence

The existing fixture `tests/TestSave` is 6,652,242 bytes. A targeted baseline run
passed 31 tests across import/export roundtrip (2), inventory swap (3), calendar
(22), and display-item disposal (4), in 21.18 seconds wall time in the local test
environment. This is a test-suite baseline, not an application latency benchmark.
Warnings about fallback item proxies occur in the existing fixture.

Use these scenarios for subsequent experiments:

- Import, visit pages, export without edits; then edit only money. Assert the
  intended field diff and separately enumerate permitted normalization.
- Select a farmhand, queue an action, switch sidebar selection, apply it; assert
  identity and shared/individual scope. Include missing and duplicate target IDs.
- Rename a farm across farmers; inject failure after writes. Assert either all
  changes publish with one receipt or none do.
- Reorder a backpack containing nil markers, Secret Notes, mod metadata and
  combined items. Preserve contents; keep review compact and evidence complete.
- Open/close recipe lists and searches, create/replace/remove items, and replace
  the imported save repeatedly. Instrument live root/disposer counts, then use
  post-GC heap comparisons to check retained objects. Existing disposer tests prove
  specific cleanup calls, not complete application leak freedom.
- Export after mutation, parse again, and compare expected semantics. Include
  multiplayer, early/late-game, compressed and representative modded fixtures.
- Measure parse, mutation prepare/commit, notification/render, export, retained
  history, and heap separately. Record hardware/runtime and avoid interpreting
  Node timings as mobile browser timings.
- Keyboard-only edit/validation/dialog workflow and a narrow touch viewport are
  acceptance scenarios for the UI experiment, not completed checks in this audit.

The #167 experiment establishes a first reproducible operation baseline and records
its limits in [its README](../experiments/v2/README.md). It does not supply the
heap baseline, browser profiling, or compatibility matrix assigned to later work.

## Calendar semantics to preserve or decide (#176)

Current `Calendar.#writeDate` changes global date fields, every loaded farmer's
display date, and host days played; it reapplies date-specific weather rules.
Today's weather edits synchronize global/default-valley representations and may
water soil/pet bowls. Existing undo-water closures are local calendar bookkeeping,
not a general action history. Date changes do not simulate all intervening nights:
crops, relationships, construction, quest timers and other game systems cannot be
assumed to have advanced.

Before migrating calendar writes, specify the treatment of backward dates,
season/year boundaries, festivals, island weather, unknown mod weather, quest and
construction timers, and watering reversal after intervening edits. A calendar
action must record whichever dependent writes it actually performs. Existing
calendar tests are useful evidence but do not replace in-game verification.

## Hypotheses and decisions still open

- Explicit mutation boundaries may be added above selected existing domain APIs;
  test whether those APIs can safely run on a draft or need extracted domain logic.
- Effect may improve execution, subscriptions and resource ownership. It does not
  define user intent, undo, review policy, or automatically roll back proxy writes.
- A read-only catalog may simplify display, but retaining display proxies with safe
  lifetimes is equally eligible for evaluation.
- UI primitives plus shared layout conventions may reduce review repetition;
  a full visual redesign is not required to validate this.
- Choose a single authoritative editing state. Svelte stores/runes can expose a
  read model; do not independently write both an Effect state graph and proxy graph.
- Decide transaction granularity, field commit timing, history limits, quiet-tag
  ownership/overrides, repair visibility, async stale-target handling, and selective
  revert dependencies in the relevant experiments.

Feature tasks #172–#179 record pets, children, mobile file handling, completion,
calendar behavior, locations, progress restoration and documentation. They are
regular backlog tasks and do not all depend on a V2 rewrite.

## References

- [Project and acceptance issues](https://github.com/users/colecrouter/projects/6)
- [Svelte effect ownership](https://svelte.dev/docs/svelte/$effect)
- [Svelte store contract](https://svelte.dev/docs/svelte/stores)
- [Mutation experiment](../experiments/v2/README.md)

The audit's code references above describe this checkout; observed risks are
distinguished from measured defects so later implementation tasks can investigate
without treating architectural preferences as requirements.

## Follow-up experiment

The expanded experiment extracts the codec into `src/lib/xmlCodec.ts`; the worker
retains Comlink exposure and byte transfer. The simplified fixture parser is removed.
Effect services now exercise the exact codec, Node platform integration, real worker
cancellation, transactions and JSON Patch. See [the adoption recommendation](v2-effect-decision.md)
for the updated conclusion and evidence limits. The audit above records the original
baseline rather than silently rewriting historical measurements.
