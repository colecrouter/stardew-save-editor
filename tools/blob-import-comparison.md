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
