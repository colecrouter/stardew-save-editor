# Blob-stream import comparison

The typed editor can import a File/Blob without first building a complete byte
array on the main thread or a complete XML string in the worker. Its browser
entry now passes the Blob to the processing worker, which consumes its byte
stream through Effect XML. The existing byte API remains available for tools,
tests and direct comparison. Export readback and the legacy editor are outside
this change.

## Results

Public fixture: 6,652,242 bytes uncompressed, 159,070 bytes with pako zlib.
Node 24.22.3 on the audit machine (Intel i7-2600K), real worker RPC plus model
acquisition. Each row below summarizes three fresh processes, **one import per
process**. The middle trial reversed case order. Decoded-data parity is checked
after capturing timing and memory, so that verification does not inflate peaks.

| Input   | Path                          | Median open time | Median peak process RSS |   RSS range |
| ------- | ----------------------------- | ---------------: | ----------------------: | ----------: |
| Raw XML | Whole byte array / XML string |           6.83 s |                 721 MiB | 670–755 MiB |
| Raw XML | Blob stream                   |           6.44 s |                 641 MiB | 631–641 MiB |
| Zlib    | Whole byte array / XML string |           6.65 s |                 658 MiB | 637–697 MiB |
| Zlib    | Blob stream                   |           6.61 s |                 645 MiB | 641–647 MiB |

Raw XML imports were about 6% faster and their median peak RSS was 80 MiB lower
(11%) in these trials. Compressed import time was essentially unchanged. Its
small median RSS reduction is within the observed run-to-run variation; these
measurements do not establish a reliable compressed-input memory improvement.

The first experiment warmed each process with an import and then measured three
more imports. That produced lower raw-input RSS but **higher compressed-input
RSS** for streaming. Those results are retained alongside the fresh-process runs
in [the raw data](profiles/blob-import-comparison.json), rather than discarded.
They show why process peak memory cannot be attributed solely to input buffers:
GC scheduling, schema allocations and previous sessions also affect it.

The streaming path is worth keeping for bounded input buffering and the observed
raw-file benefit. It is not a major throughput fix: typed interpretation still
dominates, and compressed files showed no material speed change. Peak RSS is an
observed process metric, not a bound or a promise for other saves/browsers.

## What changed

- `openEditorBlob` retains the original Blob through the RPC boundary. The worker
  opens its stream locally; no transferable ReadableStream or per-chunk RPC is
  required. The byte-based `openEditor` contract remains intact.
- The input adapter sniffs the existing zlib marker, then incrementally inflates
  compressed input. Compressed pushes are limited to 1 KiB and output chunks to
  16 KiB, preventing an entire large expansion from accumulating before parsing.
  Raw input chunks are capped at 64 KiB without copying them.
- Effect's byte XML decoder handles UTF-8 boundaries and supplies events to the
  same typed interpreter used by the text path. Generated CLR conversions,
  namespace rules, envelope/version checks and domain validation remain enabled.
- Cancellation reaches an outstanding source read and cancels it. Normal EOF
  releases the reader; malformed XML and broken zlib remain typed failures.
- The UI uses the Blob entry. A real-browser probe confirms import requests carry
  a Blob, no ArrayBuffer transfer list, and zero main-thread `File.arrayBuffer`
  calls before posting the import. It also verifies cancellation, worker lifetime,
  compressed import, exact preservation, export validation and recovery.

The streamed entry uses `ValueSchema` through the shared reader directly; the
byte reference keeps its existing XML-string schema wrapper. This compares the
complete alternative import paths, not one isolated allocation instruction.

## Memory and measurement limits

The complete decoded document, history baseline and UI projections still reside
in memory. Original backup serialization is separate and may read the original
file in full **after import**; that behavior is unchanged and is not included in
this benchmark. Export still constructs and reads back its complete output.

Node cannot structured-clone its file-backed `openAsBlob` objects, so these
worker measurements use memory-backed Blobs. Both paths start with the same
prepared Blob. Real browser File transport is verified separately, but the RSS
figures are not browser memory measurements. RSS includes the main process and
worker, allocator/GC behavior and schema/model overhead. Three runs provide
useful observations, not statistical confidence intervals.

These timings include worker startup and model acquisition. The earlier
[pipeline CPU audit](save-pipeline.md) selected synchronous processing; its
absolute timings should not be compared directly with this worker experiment.
The source and package-lock hashes in the data identify the measured code.

## Reproduction

Run cases sequentially, without tests or builds competing for CPU:

```sh
node --import tsx tools/compare-blob-import.mts bytes /tmp/raw-bytes.json --single
node --import tsx tools/compare-blob-import.mts blob /tmp/raw-stream.json --single
node --import tsx tools/compare-blob-import.mts bytes /tmp/zlib-bytes.json --single --compressed
node --import tsx tools/compare-blob-import.mts blob /tmp/zlib-stream.json --single --compressed
```

Repeat in fresh processes for three trials, reversing order in the middle trial.
Omit `--single` to reproduce the initial warmed-process experiment. Each command
verifies that the imported document equals the existing byte decoder's result.

## Does the additional subdivision help?

A follow-up changes only the input subdivision: both variants use the same
Blob, pako's 16 KiB output size, Effect byte decoder, typed interpreter and final
value validation. `native` passes each incoming chunk whole; `bounded` uses the
production 64 KiB raw / 1 KiB compressed input limits. Three fresh processes per
case, reversing order on trial two; every result checks decoded-data parity.
These are **typed-decode-only** measurements, not the worker/model timings above.

| Input   | Additional bounds | Native chunks | Median peak RSS, bounded / native |
| ------- | ----------------: | ------------: | --------------------------------: |
| Raw XML |            4.87 s |        5.04 s |                     492 / 531 MiB |
| Zlib    |            4.86 s |        4.92 s |                     480 / 481 MiB |

Timing and RSS ranges overlap, and one raw trial was faster without subdivision.
There is no consistent throughput win from removing the bounds, nor enough
samples to claim a reliable speed benefit from keeping them.

The deterministic difference is buffering:

- Node delivered the 6,652,242-byte raw Blob as one native chunk. Without the cap,
  Effect scanned that whole chunk into one event array before interpretation.
  The bounded path instead supplied 102 chunks of at most 65,536 bytes.
- In a real Chromium File stream with a 20 ms consumer delay, native raw chunks
  reached 2 MiB. Progressive arrival therefore does not imply small input batches.
- For zlib, both variants still supplied the XML decoder with 407 output chunks
  of at most 16 KiB. The additional input bound was **not needed for parser chunk
  size** here: it limited pako's pending output queue instead. Its peak fell from
  the entire 6,652,242-byte expansion to 81,920 bytes (80 KiB). A synchronous pako
  push emits its output before downstream parsing can drain the queue.

Retain the limits as explicit buffer bounds, rather than claiming they are a
necessary speed optimization. Raw slices are views: they still retain the native
input buffer; the raw cap limits downstream text/event batches, not that buffer's
backing storage. Queue-byte counts are not total process memory. The optional
reader diagnostics expose only counts and allow native-sized input for this
experiment; production defaults are unchanged.

[Samples, ranges and native chunk observations](profiles/blob-bounds-comparison.json):
Node 24.22.3 and the installed Playwright Chromium build. The native-chunk observation used Node zlib compression
(158,636 bytes); the controlled decode benchmark used pako (159,070 bytes).
Browser chunk observations demonstrate producer variability, not browser timing
or RSS benefits.

```sh
node --import tsx tools/compare-blob-bounds.mts bounded /tmp/bounded.json
node --import tsx tools/compare-blob-bounds.mts native /tmp/native.json
# Add --compressed for the zlib cases; repeat in fresh processes for three trials.
```
