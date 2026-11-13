# Scalar decoder audit

This follow-up isolates scalar conversion from Blob chunking. It uses the same
6,652,242-byte `tests/TestSave`, Node v24.22.3, bounded Blob byte stream, XML
scanner, typed frames and final document validation throughout.

## CPU profile

A warmed baseline decode sampled with Node's inspector produced 3,239 samples:

| Self samples                          | Count | Share |
| ------------------------------------- | ----: | ----: |
| Local typed reader                    | 1,268 | 39.1% |
| Effect runtime (`internal/effect.js`) | 1,247 | 38.5% |
| Garbage collection                    |   223 |  6.9% |
| XML scanner (`encoding/Xml.js`)       |   103 |  3.2% |
| Other, including schema validation    |   398 | 12.3% |

These are sampled CPU locations, not additive wall-clock phase timings or proof
that every runtime allocation is avoidable. `makePrimitiveProto` in the Effect
iterator implementation is the hottest individual location. Local hot locations
include the event loop, object child dispatch, `accepted` completion wrappers and
scalar frame creation. The XML scanner remains a small part of the work.

Run a new profile with:

```bash
node tools/profile-xml-operations.mts /tmp/xml-profile.json --profile
```

This writes the full inspector profile to `/tmp/xml-profile.json.cpuprofile`.
The profile warms the decoder first; ordinary timing runs below do not. Their
absolute times should not be compared with the earlier tsx/worker measurements.

## Controlled scalar experiment

Three fresh processes per variant, sequentially, with order reversed in the middle
trial. One measured decode and encode per process; import parity against the
existing string decoder and exported-XML readback parity run after measurement.
Peak RSS is process high-water memory through decode, before encode/parity, and
includes runtime startup and generated schema construction.

- Baseline: create the decoder/encoder helper for each scalar value; unwrap
  `SchemaError` back to `SchemaIssue.Issue` on every scalar decode.
- Cached: create decoder and encoder helpers once per text codec; retain the same
  error conversion.
- Direct: reuse helpers, with public `SchemaParser.decodeUnknownEffect` returning
  the reader's existing `SchemaIssue.Issue` error type directly.

All variants retain scalar checks, XML structure checks and completed-document
validation. The experiment changes neither stream chunk sizes nor the frame
protocol. No Effect dependency patch is involved.

| Variant  | Median decode |   Decode range | Median encode | Median peak RSS |
| -------- | ------------: | -------------: | ------------: | --------------: |
| Baseline |      4,028 ms | 3,986–4,030 ms |      1,065 ms |         531 MiB |
| Cached   |      4,027 ms | 3,765–4,053 ms |      1,043 ms |         545 MiB |
| Direct   |      3,720 ms | 3,608–4,059 ms |      1,081 ms |         545 MiB |

The direct variant reduced median decode by 308 ms (7.7%). It was faster in two
paired trials and slower in one; ranges overlap. Caching alone showed no median
improvement. Encoding showed no clear improvement. Peak RSS rose about 14 MiB
(2.6%) for the direct variant, so this is not a memory optimization. Three samples
support a modest local improvement, not a statistically established browser or
end-to-end upload/export speedup.

Keep the direct variant: it removes a redundant error conversion using Effect's
public API without weakening validation. Keep the generic `decodeValue` helper
unchanged for other callers so the measured change stays confined to text codecs.
The writer also reuses its helper; no export speedup is claimed.

A separate, temporarily instrumented baseline counted the following operations
for one decode. The instrumentation was removed before timing runs and is not
production telemetry:

- 6,748 text codec definitions (including lazy definitions first reached during decode).
- 95,688 scalar frames and finishes; 95,586 scalar text handler calls.
- 176,513 nested codec opens, including wrapper codecs; this is not an XML tag count.
- 119,975 parent acceptance wrappers and their completion calls.

Scalar decoder factory removal addresses one operation per scalar. It leaves the
much broader frame/Effect machinery intact. The next larger experiment would be
to reduce parent acceptance and object-child generator allocations while retaining
failure paths, deferred execution, cancellation and reusable decode Effects.
That requires a separate design and measurement; the profile does not justify
removing final validation or replacing Effect's XML scanner.

[All trial measurements and operation counts](profiles/scalar-decoder-audit.json).
For a single ordinary run at either revision:

```bash
node tools/profile-xml-operations.mts /tmp/scalar-run.json
```

For the cached-only control, replace the direct parser with
`Schema.decodeUnknownEffect(codec)` and map its error to `error.issue` in `finish`.
For the baseline, use `decodeValue(codec, text)` in `finish` and
`Schema.encodeSync(codec)(value)` in the writer, as in commit `f4a354a`.

Validation for the retained change: all 20 game-data tests and 13 focused editor
save/Blob tests pass, as do `npm run check`, `npm run format:check` and the
production build. Type/Svelte checks retain 14 existing experimental XML API
warnings. Each of the nine benchmark processes also passed import and export
readback equality checks outside its measured interval.
