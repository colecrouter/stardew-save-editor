# V2 projection cache ownership investigation

This is the pre-implementation investigation. The owner subsequently approved
immutable domain projections; see [the implemented boundary](v2-domain-projections.md).

This follows #204 on `e8edf96`, before changing the UI projection contract.
The reproducible profiler now measures copying a previously built chest view as
well as rebuilding it. A cache hit under the current detached mutable-view
contract must at least pay that copy cost, before checking dependencies.

## Evidence

On the recorded Node 24 / Apple M4 Pro run, the 9,012-slot scenario took a median
8.62 ms to rebuild chest views, versus 11.63 ms merely to detach the cached
view. Five standalone probes follow the normal 16-edit and eight-queued-edit
scenarios. These are local instrumented Node observations, not browser frame
measurements. The [raw report](profiling/editor-projection-investigation.json)
records matching core source fingerprints before and after the run.

The chest view contains raw items plus slot descriptors. Copying that expanded
representation can cost more than cloning raw item arrays and mapping them. A
lower projector invocation count would therefore misrepresent the result.
Other feature projections are comparatively small in these samples; adding
broad caching machinery to them first is not justified by this measurement.

Reproduce using the command in [the performance profile](v2-performance-profile.md).
The `cachedChestDetachment` probe is a lower bound for a mutable-view cache hit,
not a complete implemented cache benchmark.

## Ownership decision

A useful cache may instead publish immutable UI views and share unchanged
feature values across revisions. Engine snapshots and transaction draft reads
can retain their existing detached mutable contract. This is a separate boundary
from the planned XML/parser/raw-type replacement. It requires an explicit owner
decision because deliberately mutating a projected UI view currently succeeds
without touching the engine, whereas an immutable view must reject that mutation.

Before adoption, compare the actual freeze/cache-hit path with rebuilds, not just
projector call counts. Keep one private canonical result per feature and clear it
with the file session. Derive invalidation from authoritative committed inputs,
not operation labels: custom/compound writes, Undo/Redo and skipped stream
revisions must remain correct. An independent design reviewer recommended
numeric dependency versions computed before history detachment, with selectors
owned beside domain readers. Exposing arbitrary callbacks over authoritative
mutable history would weaken isolation and should be avoided.

The first meaningful candidate is placed-chest projection. Its dependencies are
world locations (including building interiors), collision-relevant farmer IDs,
and session inventory identities. A farm name or calendar change should not
invalidate it. Whole-player invalidation would lose that benefit.

#201 remains open. No production cache has been introduced by this investigation.
