# Editor foundation experiments (#166, #167)

Runnable comparisons of plain TypeScript mutations and an Effect 4.0.6 application
layer. Effect remains outside the production app's dependency graph. The production
XML codec is extracted from worker transport so these experiments use the actual
save-format implementation. Browser Comlink behavior and codec rules are unchanged.

## Run on Node 24

```sh
npm ci
npm ci --prefix experiments/v2
npm run check --prefix experiments/v2
npm test --prefix experiments/v2
npm run demo --prefix experiments/v2
npm run demo:platform --prefix experiments/v2
npm run measure:bundle --prefix experiments/v2
```

Use `npm.cmd` if PowerShell blocks `npm.ps1`. The root install supplies dependencies
for the shared production codec and esbuild for bundle measurement. A separate Node
24 CI job runs the experimental checks, tests and platform demo. Native execution
requires explicit `.ts` imports, type-only imports and erasable syntax. No tsx is
installed here; root codegen and the Svelte compiler retain their existing tooling.

## What runs

Both mutation executors share domain logic and draft/commit semantics: edit farmer
money, rename a farm across farmers, and reorder backpack slots. Both produce
identical documents and intent/change receipts. Failed preparation publishes neither
partial state nor successful history; no-ops produce no receipt. Compact reorder
receipts still retain actual changes. Money is a field-edit experiment, not a complete
shared-wallet API. Farmer targets must resolve uniquely. Slot permutations preserve
opaque items, nil markers and Secret Notes. Arrays are recorded as complete values.

The Effect session adds serialized SubscriptionRef updates, typed failures, scopes
and consumer fibers. A tested Svelte store contract exposes snapshots without a
second writable state graph. A rendered Svelte component and subscriber error
handling remain future work; notifications are not a durable event log.

SaveCodec is a Context service with direct and real-worker layers. It composes strict
UTF-8/zlib decoding, XML validation, production codec behavior, minimum-envelope
Schema checks, and version checks. Schema's decoded projection is not substituted
for the complete document, so unknown fields survive. This is not full game validation.
Truncated zlib can return undefined rather than throw, which is explicitly handled.

The platform program requests abstract filesystem/codec services; its CLI assembles
NodeServices and NodeRuntime. It reads the real fixture, edits, encodes, reparses,
and writes/reads a scoped temporary output that is removed automatically. Tests can
substitute services without module mocking. A browser would supply File/worker ports.

The worker layer starts a real Node worker per request and awaits termination on
success, error or cancellation. This intentionally costly arrangement proves ownership,
not an optimized pool. Production Comlink remains; replacing it is not a prerequisite.

Eight native Node tests cover mutation semantics. Twelve @effect/vitest tests cover
the production codec, compression, opaque fields, typed errors, service substitution,
scoped files, cancellation, actual workers, transactions, JSON Patch and net review.
Ten canceled worker requests leave zero tracked live workers. These counts are not
a comprehensive heap-leak measurement or proof about existing item proxies.

Effect.tx commits document/history refs together, but cannot undo an ordinary object
mutated in place after reading from a ref. The experiment demonstrates that unsafe
case explicitly. Existing proxy writes need isolation/adaptation. JSON Patch supports
forward/reverse patches for linear history; intent tags and selective revert still
need domain policy.

## Measurements

Native Node v24.11.0 on Windows, ten alternating-order rounds on tests/TestSave
(6,652,242 bytes), with production codec and portable comparison:

- Parse: 486 ms.
- Construct session plus three operations: plain median 108.4 ms (103.0–116.1 ms),
  Effect median 109.2 ms (106.4–110.8 ms).
- Serialized XML text: 2,736,660 UTF-8 bytes; platform output adds a three-byte BOM.
  Reparsed output equals the edited document.

Mutation timings include copying, diffing and returned snapshots, but exclude parse,
export, browser rendering, module startup and mobile hardware. These are descriptive
samples, not statistical claims. The large fixture has no farmhands; a small fixture
checks multiplayer operations.

Standalone minified ES2022 browser bundles from measure:bundle:

- Plain session: 2,041 bytes / 990 gzip bytes.
- Effect session: 174,919 bytes / 57,366 gzip bytes.
- Effect codec service: 443,423 bytes / 140,433 gzip bytes, including XML/compression.

These are independent synthetic bundles, not incremental app downloads; do not add
them together. Compilation proves these entries can bundle for browsers, not that
browser workers or rendered mobile interactions are verified.

## Conclusion

Recommend incremental Effect adoption for session/application services, operations,
resource scopes and domain tests. Retain Svelte presentation and existing format
knowledge. See [the decision](../../docs/v2-effect-decision.md).

Outstanding: bounded history, UI review policy, selective revert, real item/view heap
stress testing, browser-worker integration, mobile profiling, shared-wallet semantics,
unknown-array conventions and input commit granularity. Full-save cloning on every
keystroke is not a production recommendation. The fault-injection hook is not a
plugin API. #168 and #169 remain open.
