# V2 large-save edit profile

This is a bounded Node profile of the application editor command/history path,
using the committed public `tests/TestSave` fixture and deterministic synthetic
chests. It is not a browser rendering benchmark, a cross-machine comparison, or
proof of a total heap bound. The script records Node/OS/CPU, input configuration,
source fingerprints, and raw phase metrics so a later run can be compared honestly.

## Reproduction

From the repository root, with Node 24 and dependencies installed:

```sh
node --expose-gc --import tsx tools/profile-editor.mts \
  --samples 16 --extra-chests 250 --output /tmp/editor-profile.json
```

The harness reads no private player save. The larger scenario appends 250 supported
placed chests, each with 36 ordinary item records and 256 synthetic opaque
characters per item. It verifies the real import/model boundary by opening the
serialized document. Every measurement changes the farm name through the normal
file-owned command queue and typed domain operation.

Three warm-up edits establish a changed current document. Sixteen awaited writes
then share one field gesture. A separate burst submits eight edits before awaiting
any of them, measuring the queue delay a fast typist accumulates. A zero-delay
turn drains trailing stream delivery before phases are measured. Native
`structuredClone` calls are counted and timed, including clones in projections;
that instrumentation has overhead and clone time is part of—not additional to—
command wall time.

Memory observations use three forced collections at each phase. Active-gesture
heap minus ended-gesture heap is an observed process delta, not an exact retained
object graph size. RSS can remain high after collection/close because allocator
pages and runtime caches are not identical to live editor-owned objects. Phase
snapshots and standalone projection probes are taken outside timed editing.

## Baseline observations

Initial measurements loaded the pre-cleanup command/history implementation at
`10b0619` on Node 24, Apple Silicon. One run of each scenario used 16 sequential
samples and an eight-edit burst. XML whitespace differs after synthetic
serialization, so parsed JSON size and inventory slots are the useful scale
comparison, not XML byte size alone.

| Scenario             |     Parsed JSON | Numbered inventory slots | Sequential median / p95 | Eight-edit burst last response | Clones per sequential edit |
| -------------------- | --------------: | -----------------------: | ----------------------: | -----------------------------: | -------------------------: |
| Committed fixture    | 1,728,391 bytes |                       12 |        156.8 / 160.2 ms |                     1,220.2 ms |                         26 |
| Fixture + 250 chests | 5,435,889 bytes |                    9,012 |        317.8 / 332.1 ms |                     2,421.5 ms |                      9,026 |

Measured clone time accounted for approximately 48% and 51% of instrumented
sequential wall time respectively. The large per-edit clone count came from
individually detaching every chest item during the aggregate projection, even
though the edit affected only the farm name.

Standalone median probes isolated 18.4/31.3 ms for baseline document diffing and
0.09/11.7 ms for chest projection on the fixture/large scenario. These probes do
not include the full view assembly, calendar options, registry publication or
browser rendering, and should not be summed into a claimed total projection time.

The five retained history entries used 5,680 bytes for the fixture and 1,160,072
bytes for the larger save. Grouping reduced the sixteen sequential writes to one
entry, but did not eliminate the writes, clone work, or queued latency. The larger
entry payload includes the inventory identity snapshots even for unrelated edits.

Observed active-minus-ended heap was 2,339,168 bytes for the fixture and 7,059,976
bytes for the larger scenario. A gesture beginning after earlier edits keeps its
starting document/history reachable in addition to the import baseline and latest
committed document. That starting snapshot is intentionally outside the serialized
Undo-entry byte budget. The budget therefore limits retained entry payloads, not
all live editor state or process memory.

## Concrete optimization and ownership boundary

A metadata-only gesture close originally emitted an unchanged document revision
through the history stream. The stream detached the full state before the model
discarded the duplicate revision. An isolated fixture probe counted one clone
costing 16.97 ms. Filtering equal revisions **before** detachment reduces that to
zero clones, while preserving the initial snapshot and every real revision.

The profile also motivated detaching supported inventory slot arrays once per
owner rather than cloning each item separately. Views must still be independent
of imported/session records and of other projected views; removing detachment
would be a correctness regression rather than an optimization.

## Practical limits

The baseline results show a real responsiveness limit: rapid input can queue more
than a second of work on the fixture and more than two seconds on the synthetic
save. Undo grouping alone does not address that. Lazy panel mounting removes
unvisited control work, but the model still computes one aggregate projection.

The retained-entry byte cap, measured gesture delta, and observed process heap
are different quantities. None establishes a peak-memory guarantee. Larger saves,
longer gestures, more farmers, browser control rendering and lower-end devices
remain outside these samples. Preserve the benchmark as a repeatable diagnostic;
measure feature invalidation and document-clone reductions before claiming those
costs solved. Do not replace this evidence with an arbitrary test timeout increase.

## Cleanup measurements

The final run used the same inputs and sample counts on Node v24.22.2, macOS
Darwin 27.2.0, Apple M4 Pro. Source fingerprints matched before and after the run.
Raw observations are committed alongside this report:
[baseline JSON](profiling/editor-baseline.json) and
[final JSON](profiling/editor-final.json). The baseline run predates source hashing;
the final artifact records hashes of the three measured core modules.

| Scenario             | Final sequential median / p95 | Final eight-edit burst last response | Final clones per edit | Gesture-close clones |
| -------------------- | ----------------------------: | -----------------------------------: | --------------------: | -------------------: |
| Committed fixture    |              162.3 / 179.7 ms |                           1,287.9 ms |                    15 |                    0 |
| Fixture + 250 chests |              294.8 / 308.3 ms |                           2,340.6 ms |                   265 |                    0 |

Batch detachment reduced large-save clone calls from 9,026 to 265 per edit. It
copies the same represented item data, so reducing call count is not equivalent
to eliminating that allocation. The fixture latency is essentially unchanged;
the larger run's median is about 7% lower. This is a small sample under normal
machine activity, not statistical evidence that every environment improves by
that percentage. Queued typing still takes more than two seconds to drain in the
larger scenario. Whole-document cloning and baseline diffing remain substantial.

The metadata-close fix needed care: a first attempt with `Stream.changesWith`
retained the last emitted **raw** history state, including its open gesture.
Suppressing the metadata-only close then kept that gesture's starting document
reachable. The measured active-minus-ended heap delta fell to approximately zero,
although it had previously dropped by about 2.34/7.06 MB. Replacing that comparator
with per-subscription **revision-number-only** state restored the drop while
retaining zero close-time clones. Final observed heap release was 2,338,960 and
7,059,768 bytes respectively. This is why dropping stream emissions must be checked
for retained ownership as well as latency.

These changes complete the measured local improvements, not a blanket performance
or memory guarantee. The remaining release decision should account for the
measured queue delay and scope future optimization around document copies,
unchanged feature invalidation and redundant identity payloads. A larger save is
still allowed to cost more; history-byte settings do not currently express a
maximum total working-set budget.

## Follow-up ownership

Remaining performance work is tracked in [#201](https://github.com/colecrouter/stardew-save-editor/issues/201).
Inventory controller composition and metadata boundaries are tracked in
[#202](https://github.com/colecrouter/stardew-save-editor/issues/202).
See [current V2 status](v2-status.md) for coverage and extension conventions.
