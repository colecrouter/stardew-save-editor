# V2 edit publication performance

This is the first measured implementation slice of [#201](https://github.com/colecrouter/stardew-save-editor/issues/201),
following the [cleanup profile](v2-performance-profile.md). It changes history
publication and review comparison, not Undo retention policy or XML parsing.

## Ownership and work removed

History previously detached the complete prepared save before computing patches.
That made unchanged document branches distinct objects on every revision, forcing
forward, inverse, gesture-baseline and net-review comparisons to walk them again.

Publication now detaches changed patch values and applies those patches to the
session-owned immutable document. Unchanged branches remain shared internally.
Grouped edits first recover sharing against the latest revision, then compare
with the gesture baseline to preserve one net Undo entry. Net review is computed
once on the internally shared document and detached with the public snapshot.
Undo/Redo and history eviction retain exact import-relative review behavior.

Custom adapters may retain mutable prepared documents, so their inserted values
must be cloned before publication. Public snapshots, review patches and projected
raw item records remain detached. Transaction draft reads/replacements keep their
existing isolation; this does not introduce a mutable proxy into the UI.

Inventory authorization also avoids cloning the baseline for replay when no
inventory writes or capacity changes were approved. It still compares baseline
and final inventory snapshots, rejecting raw unauthorized changes.

## Reproduction and evidence

Use the same command and fixture construction documented in the cleanup profile:

```sh
node --expose-gc --import tsx tools/profile-editor.mts \
  --samples 16 --extra-chests 250 --output /tmp/editor-profile.json
```

Both recorded runs use Node 24 on the same Apple M4 Pro, with no validation suite
running concurrently. Each artifact records matching source fingerprints before
and after its run. The baseline is merged `7285860`; the final artifact identifies
that parent commit plus hashes of the modified core modules. The raw observations
are [before](profiling/editor-performance-before.json) and
[after](profiling/editor-performance-after.json).

| Scenario                           | Before median / p95 | After median / p95 | Last queued response before / after |
| ---------------------------------- | ------------------: | -----------------: | ----------------------------------: |
| Public fixture                     |    153.3 / 159.5 ms |     64.5 / 72.0 ms |                  1,182.6 / 508.5 ms |
| Fixture + 250 chests (9,012 slots) |    282.0 / 296.6 ms |   139.5 / 145.7 ms |                2,258.6 / 1,097.9 ms |

These are instrumented Node command-path samples, not browser frame timings or
cross-device guarantees. The final run follows an exploratory run with the same
pattern; this is not a statistical significance claim. Native clone calls rise
from 15/265 to 17/267 per edit because small patch clones replace large document
copies. Call count alone is not a copied-byte or retained-memory measurement.

The observed heap released on gesture closure changes from about 2.34/7.06 MB to
noise-level deltas (-1.5/-18.1 KB). Unlike the earlier stream-retention bug, this
implementation does not retain another complete starting save: a farm-name edit
shares the unchanged inventory and world branches with its baseline. Active and
ended large-scenario heap were both about 52.1 MB in the final run, compared with
66.0/59.0 MB before. Process heap/RSS and a GC-conditioned delta do not prove a
maximum working set or absence of all leaks. The gesture still owns its small
starting revision and releases the reference on close. Serialized entry bytes
still do not bound total editor heap.

## Validation and independent review

919 application tests pass across 99 files, including a new regression that
mutates retained nested adapter values and public net-patch values, then checks
unchanged authoritative state and exact Undo/Redo. Existing suites cover grouped
return-to-original/redo restoration, identity-only inventory changes, unauthorized
raw inventory writes, budget rejection, eviction and full-save export preservation.
The 98 experiment tests, app/experiment checks, Effect diagnostics, formatting and
production build also pass.

An independent reviewer found no blocker and ran 42 focused session, gesture,
inventory and receipt tests plus the publication regression. The review checked
patch-value ownership, immutable sharing, cached review and the no-write
inventory authorization path. Its suggested nested-mutation assertions are
included in the final test.

## Remaining #201 work

The aggregate model still rebuilds all feature views per revision, and public
snapshot/draft isolation still copies document data. The large queued-input
measurement remains too high to claim responsiveness solved.

Simple reference-based projection caches cannot work across detached snapshots.
Reusing exposed mutable raw item views could carry consumer mutations into later
revisions. A future cache should own private canonical projections and detach
outgoing values, with invalidation derived from actual committed changes and a
conservative rebuild after skipped revisions. Avoid a hand-maintained table of
operation names that misses compound or custom-adapter writes.

Browser input-to-paint/queue measurements on representative desktop/mobile
hardware and explicit release latency/memory budgets remain outstanding. Keep
#201 open for those measurements and projection work; these Node results are an
engineering comparison, not a release performance budget.
