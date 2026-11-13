# Save pipeline audit

Audited current main at `60689e1`, with Effect 4.0.6 and the committed public
`tests/TestSave` (6,652,242 UTF-8 bytes). The bottleneck is the application's
**typed XML event interpreter**, not Effect's XML scanner, final value validation,
or structured cloning. Export pays for that interpreter again during readback.

## Measurements

Milliseconds, median of three samples after one warm-up per probe, Node 24.22.3
on an Intel Core i7-2600K. Runs were separate from correctness suites. Raw sample
ranges are committed in [before](profiles/save-pipeline-before.json) and
[after](profiles/save-pipeline-after.json).

| Operation                             | Before | After | Change                            |
| ------------------------------------- | -----: | ----: | --------------------------------- |
| UTF-8 conversion                      |      5 |     5 | Sample/GC variation               |
| Zlib inflate                          |     38 |    41 | Sample/GC variation               |
| Raw Effect XML scan                   |    123 |   135 | Sample/GC variation               |
| Typed save decode                     |  5,863 | 4,332 | 26% faster                        |
| Completed typed value validation      |    157 |   139 | Sample/GC variation               |
| Typed save encode                     |    955 | 1,021 | Encoding implementation unchanged |
| Structured clone of typed document    |     27 |    33 | Sample/GC variation               |
| Current model open                    |  5,862 | 4,262 | 27% faster                        |
| Current validated export              |  6,730 | 5,201 | 23% faster                        |
| Legacy representation parse           |  1,491 |   458 | 69% faster                        |
| Legacy representation build and clone |    305 |   483 | 59% slower                        |

These are CPU-oriented wall times on one machine, not browser latency guarantees
or confidence intervals. Independent medians cannot be added or subtracted as
precise stage accounting. The scale difference is decisive: the raw scanner takes
about 0.12 seconds and final type validation about 0.16 seconds, while typed
decode takes about 5.9 seconds before this change. A short CPU profile corroborates allocation
and GC pressure: Effect primitive construction and interpreter/frame callbacks
are hotter than the XML scanner itself.

The current typed path still costs substantially more than the legacy property
representation. It performs generated CLR conversions, namespace and polymorphic
dispatch, collection rules and typed failures for each element. The legacy parser
does not establish those typed guarantees. The gap is not a lower bound on typed
correctness: further work should reduce frame/scalar wrapper allocation and
dispatch while retaining those guarantees.
Switching XML scanners alone does not address that work.

## Pipeline and fixes

Current browser upload creates a scoped processing worker, reads/decompresses
bytes, decodes UTF-8 and runs the generated `XmlSchema` decoder in that worker.
It checks the minimum envelope/version and domain validation there, then returns
the typed document to the main thread for history, identities and read models.
The original file is backed up separately. Export queues behind edits, detaches
the export revision, sends it to the worker, encodes it, decodes the exact output
bytes again and applies domain validation before download. Output readback is
therefore the largest component of export, not byte encoding or cloning.

The local interpreter in `src/lib/save-format/xml.ts` intended to bound event
batches by slicing input into 16,384-code-unit strings. However,
`Stream.fromIterable` groups up to thousands of iterable values by default. The
XML channel processes its entire input array before yielding its event array,
so it could reconstruct a document-sized event batch despite those slices.
Setting `chunkSize: 1` makes the intended bound real, reduces transient event
retention, and lets typed errors stop input consumption promptly.

The reader also constructed a generator Effect and error wrapper for each
individual event. It now interprets a bounded event array inside one generator
and error wrapper. Frame operations remain fallible Effects, and the active
event/finished header preserve exact failure paths. Generated schemas, lexical
conversions, namespace rules, worker ownership and export validation remain in
place. The streaming regression uses a producer that defects if read past an
invalid first batch, making eager input consumption observable without a timing
assertion.

## Removing fast-xml-parser

On current main, `fast-xml-parser` only served the retained legacy codec; the
current editor already used Effect XML. The legacy codec now adapts Effect XML
events to its existing property representation, retaining its collection rules,
attributes, scalar inference, whitespace and equipment handling. Equipment slot
entries are allocated once rather than at every recursive visit. No new parser
dependency is introduced. The manifest, lockfile and Vite optimization entry are
removed, along with eight unused supporting packages.

The replacement's legacy serializer is slower in isolation, as shown above.
Legacy parsing is substantially faster. The current typed encoder is unaffected;
its export improvement comes from the faster readback interpreter. This audit
does not claim every individual operation became faster.

The full public legacy parse was compared against the previous codec: game data
matched; the old top-level BOM `#text` artifact is omitted. Regression coverage
includes full saves, equipment/nil slots, numeric-looking names, imprecise IDs
and decimals, significant whitespace, entities/CDATA, declarations, processing
instructions, malformed XML, prototype-like names and input chunk boundaries.
The legacy adapter permits large opaque tokens while retaining Effect's default
nesting guard. As with the existing typed reader, custom DTD entity expansion is
unsupported. Effect XML is experimental in the already-pinned 4.0.6 release;
its source and diagnostics were reviewed rather than suppressing that status.

No upstream Effect parser PR is justified by this workload: its scanner is a
small fraction of the measured work. The concrete fix belongs to this
application's event batching and interpreter, alongside dependency removal.

## Reproduction and limits

```sh
node --import tsx tools/profile-save-pipeline.mts /tmp/save-pipeline.json
```

The harness uses `SaveCodecLive`, the generated schema and actual
`openEditor(SaveProcessingSync, ...)` / `model.commands.export()` operations.
Repeated open samples include closing the previous unmounted model. It selects
synchronous processing explicitly to isolate CPU work shared with the worker;
worker transport/lifetime is covered separately by the existing Node integration
suite. Browser file IO, worker startup/messaging, backup storage, rendering and
download UI are excluded. Neither the legacy parse row nor the model-open row is
a complete browser UI benchmark. Actual worker transport cannot explain the
multi-second difference between raw scanning and typed decoding measured here.
