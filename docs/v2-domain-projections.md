# V2 component-facing domain projections

Components consume the editor's meaning, not a copy of Stardew's serialized
records. A projection should answer what a control can show or do without making
that control decode save variants, construct defaults, or resolve legacy metadata.
This is the extension rule for future screens as well as the inventory migration.

## Inventory and appearance boundary

`inventory-views.ts` projects a saved instance into its display name, description,
quantity, quality, drawing instructions, supported property controls and equipment
eligibility. Slot position and opaque instance identity remain distinct; edits
capture identity and domain command meaning rather than mutable record references.
`item-presentation.ts` owns legacy metadata interpretation. Rendering components
need neither generated save types nor `ItemData`, `Sprite`, saved subtype checks,
color decoding or raw item records. The picker receives catalog choices and asks
the domain factory to create a record by choice ID.

Appearance likewise exposes ordered preview drawing layers and notices through
its domain view. Imported equipment and colors stay behind the adapter. Unknown
or modded data remains preserved in the authoritative document and detached engine
snapshots; removing `raw` from component-facing items does not remove it from
exports or normalize it during inspection. Unsupported views can remain visible,
with explicit unavailable controls or unknown visuals.

The mutation module remains separate from presentation so the native Node history
engine does not import browser asset aliases. Experiment view tests resolve the
same generated-data aliases as the application; native engine tests still run
without a Vite resolver.

## Immutable publication and bounded caching

`EditorView` is deeply readonly in TypeScript and recursively frozen at runtime.
That includes drawing layers, property options, history presentation and nested
feature collections. Catalog choice metadata is frozen too; its drawings resolve
lazily so merely opening the editor need not build every catalog sprite. Local
input-controller state stays mutable, and editing continues through domain
commands. Engine snapshots and transaction draft reads retain their detached,
mutable contract.

One private chest projection belongs to each file session. History compares the
actual committed chest dependencies before detaching public state and publishes
a numeric `chestRevision`. The domain-owned selector covers world locations and
building interiors, farmer IDs that could collide with chest IDs, and inventory
identities. Identity comparison currently covers all owners conservatively. A
farm name or calendar edit can reuse the same immutable chest view; an item,
location or collision change rebuilds it. Undo/Redo follows the same rule.

Dependency comparison uses authoritative immutable references/scalar data, not
operation labels or equality between detached snapshots. Custom operations can
change fields their labels do not describe; skipped stream revisions cannot
skip a token change. Byte-identical replacement data does not invalidate merely
because an adapter allocated a new object. Cache replacement releases the prior
canonical projection, and session cleanup clears the cache. There is no archive
indexed by every historical revision.

The remaining small projections still rebuild per document revision. Caching
every reader is not a goal by itself: the measured cost must justify the retained
data and invalidation contract.

## Internal publication channel

History defines mutation preparation once and selects how to deliver its result.
Ordinary commands, snapshots and streams still return detached mutable history.
The model's owner-only `forProjection` channel converts the captured command result
or filtered stream revision directly into domain views and small revision/identity
stamps. It never rereads the latest state to manufacture a command receipt: another
writer or queued Undo could already have changed it.

The synchronous projector borrows engine-owned state without mutating or retaining
it. Its output contains detached presentation values and scalars. In particular,
review patches and annotation descriptors receive a narrow copy before the view is
frozen. No saved-state reference may escape through a presentation descriptor.

Projection and publication are separate. An enclosing Effect transaction can retry
projection, so it must not write to Atom or replace the model's chest cache. The
model publishes only after the complete command succeeds, rejecting duplicate and
late older revisions. Its projected stream still observes other models and direct
engine writes; ordinary subscribers retain their detached-copy contract. A bounded
presentation cache and on-demand command facade preserve file-scope cleanup.

## Verification

Regressions cover immutable nested public data, mutable independent engine
snapshots, cache reuse after unrelated writes and their Undo/Redo, item changes,
custom world-storage changes, equal-data replacements and farmer-ID collisions.
Existing preservation and operation tests continue to check opaque nested data,
actual backpack sizes, equipment validation, grouped editing and exact Undo/Redo.
Independent reviewers checked the domain/ownership boundaries and focused tests.

The [cache ownership investigation](v2-projection-cache-investigation.md) records
why cloning cached mutable views was rejected. The final performance results
are recorded with the raw profiler outputs; Node command-path measurements do
not establish browser input-to-paint or release memory budgets. #201 remains
open for those measurements and the remaining document/draft copying costs.

## Measured command-path result

The recorded baseline is merged `e8edf96`; the final artifact records that parent
plus hashes of the modified core and presentation modules. Both runs have stable
source fingerprints and use the same 16 sequential edits/eight queued edits on
the public fixture and deterministic 250-chest scenario. No full validation suite
ran concurrently with these instrumented Node 24 / Apple M4 Pro measurements.
Raw data: [before](profiling/editor-projection-before.json) and
[after](profiling/editor-projection-after.json).

| Scenario | Before median / p95 | After median / p95 | Last queued response before / after |
| -------- | ------------------: | -----------------: | ----------------------------------: |
| fixture  |      63.6 / 67.4 ms |     65.0 / 69.8 ms |                    517.1 / 528.8 ms |
| large    |    133.8 / 143.4 ms |   125.4 / 137.1 ms |                   1092.2 / 994.1 ms |

The small fixture is effectively unchanged; the large-save sample shows a modest
command-path improvement. This single-run comparison is not statistical evidence
or a browser input-to-paint guarantee. Whole-document draft reads/replacements
and detached snapshots remain significant. A queue can still accumulate visible
latency, so #201 stays open for browser measurements and explicit release budgets.

Unrelated farm-name edits now make 14 native clone calls per edit in both sizes,
compared with 17/267 before. Fewer calls alone do not establish allocation savings;
the important ownership change is that public inventory views contain no raw save
records and a chest cache hit performs no per-chest cloning or reconstruction.
A real inventory/location change still rebuilds and freezes its projected view.
GC-conditioned heap and RSS are included in the raw data, not presented as a
peak-memory guarantee. Compared with the previous sample, the final active heap
is higher by roughly 4 MB on the small fixture and 3 MB on the large scenario.
Presentation now loads catalog/preview metadata at the domain boundary and keeps
one drawing/control descriptor per projected item. This is a measured retention
tradeoff, not a memory reduction claim. The cache holds only the current chest
projection and releases it with the file session; future owner-scoped projection
could avoid eagerly describing items in unvisited storage.

Final verification: 926 application tests across 101 files, 98 experiment tests,
app/experiment checks, zero Effect diagnostics, formatting and production build.
The final independent review passed 26 focused tests and all 11 native Node tests
with no blocker. The reference-equality identity fast path added after review was
covered by the two final cache regressions before the final profile.
