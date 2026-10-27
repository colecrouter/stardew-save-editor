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
npm run effect:diagnostics --prefix experiments/v2
npm test --prefix experiments/v2
npm run demo --prefix experiments/v2
npm run demo:platform --prefix experiments/v2
npm run measure:bundle --prefix experiments/v2
npm run check:ui --prefix experiments/v2
npm run lab --prefix experiments/v2
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
second writable state graph. The inventory lab below exercises rendered fields
and error handling; notifications are not a durable event log.

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

Eleven native Node tests and eighty-two @effect/vitest tests cover mutation and
calendar semantics, the production codec, compression, opaque fields, typed errors,
service substitution, scoped files, cancellation, actual workers, transactions,
JSON Patch, net review and the complete calendar/bundle editing model.
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

Outstanding: history checkpoint/persistence policy, UI review policy, selective revert, real item/view heap
stress testing, browser-worker integration, mobile profiling, shared-wallet semantics,
unknown-array conventions and input commit granularity. Full-save cloning on every
keystroke is not a production recommendation. The fault-injection hook is not a
plugin API. #168 and #169 remain open.

## Transactional history prototype

`history.ts` implements an alternative session using TxSubscriptionRef and Effect.tx.
Its state holds the original import, current document, bounded forward/reverse patch
entries and an undo cursor. It does not retain a full save snapshot per action.
Entries retain constituent intents, a group label and review emphasis. Undo/redo
apply patches; editing after undo truncates the redo branch. No-ops and failed groups
preserve redo. An outer Effect transaction can roll back several history updates.

Eviction caps entry count and serialized bytes (default 100 entries / 8 MiB). The import baseline remains, so net review still
accounts for changes whose undo entries were evicted. A dropped count explicitly
signals truncated action history; historical intent is not retained after eviction.
Quiet changes remain recorded. A single oversized entry is rejected before publication; heap overhead and checkpoint strategies still need assessment.
Parsed JSON data is validated without normalizing away unsupported values. Read
models and exposed patch payloads are detached copies.

Nine additional tests cover grouped reversal, failure, outer-transaction rollback,
branching/no-ops, quiet operations, eviction, concurrency/net review, full-save
undo/redo and lifecycle/read isolation. This is linear history, not selective revert,
persistent history or a finished reviewer. See
[TxSubscriptionRef](https://effect.website/docs/v4/api/effect/TxSubscriptionRef).

## Inventory presentation comparison

The isolated lab at http://127.0.0.1:5190 runs the same Svelte panel over Atom and store
models, each using the transactional history service. Start it with `npm run lab
--prefix experiments/v2`; mode switching starts a fresh session. Stack fields execute
mutations rather than writing raw data. Twelve paired tests include real-save export,
target capture, unrelated-update suppression, invalid edits, and consumer cleanup.
The suite now totals 78 tests (11 native / 67 Effect). See
[the comparison](../../docs/v2-atom-comparison.md) for findings and limitations.

## Shared fields and identity

`field.ts` owns an editing interaction's draft, validation, pending/error state,
and source-conflict handling. A field snapshot carries a commit operation bound
to its original item and document revision. Typing does not mutate the save.
Changing selection preserves dirty input; reloading explicitly starts a new draft.
Revisions increase across undo/redo, preventing stale commits even after the
document returns to the same value. Unrelated document edits currently also
require a reload: conflict detection is conservative, not field-granular yet.

The history session allocates item identities separately from save data and moves
them atomically with reorders. Duplicate items remain distinct through undo/redo.
A reorder of byte-identical items can have an identity-only history entry with an
empty XML patch. Handles resolve stack actions against current slots; identities
are never written to exported XML. Placement, removal and moves into empty slots within/across farmer backpacks are also covered. Catalog-driven construction, stacking/merging and other container types still need adapters.

Native and Bits UI reorder confirmations can be compared in the lab. Both pass
keyboard cancellation/focus return and commit/cancel checks. Bits UI loads only
when selected, in a separate 14.48 KB gzip chunk in this build. This simple dialog
does not justify requiring Bits for every modal; complex selection/popover flows
still need comparison. Both models, both dialogs, draft conflicts, Enter submit,
undo/redo and a 390px viewport were exercised in Chromium through Playwright after
T3 preview snapshots timed out twice. The final console had no errors or warnings.

TypeScript 7 and Effect diagnostics run from the root tool installation. Svelte
keeps a compatible TypeScript 6 compiler SDK. Routine checks omit suggestions;
the diagnostic command includes them. The experiment disables `unstableApiUsage`
because Atom and platform APIs are intentionally being evaluated; other rules
remain enabled. The complete current stream has no errors, warnings or messages.

See [the control and operation follow-up](../../docs/v2-controls-and-operations.md)
for production lifetime repairs, the calendar migration prerequisite, and the
byte-budget and domain-service experiments.

## Operation-owned state in history

`makeHistorySession(document, limits, initialDomainState)` keeps a plain JSON
record alongside the document. Operation preparers can return `domainState`;
omitting it preserves the current value, and an explicit `{}` clears it. Core
preparation forwards it. Document, identity and domain-state changes share one
transaction and undo boundary, including domain-only entries with empty XML
patches. Revisions still advance, so an ordinary-choice update invalidates a
stale draft even if the exported save has not changed.

History captures before/after domain-state snapshots and includes them in its
serialized byte budget. This duplicates metadata rather than optimizing it into
patches. The current state and transient clones are not a heap budget. Export and
net review use `document` alone; semantic receipts describe the operation.

The engine clones before preparation and detaches results before publication, so
failed in-place writes and adapter-retained draft references cannot change live
state. External effects still cannot be rolled back by cloning. Non-record roots,
resources, cycles, undefined fields and non-finite values are rejected, rather
than normalized through JSON.stringify. Tests also cover hostile-looking keys,
oversized metadata, redo preservation and enclosing transaction rollback.

## Transactional calendar prototype

The default `EditorOperations` service now prepares calendar date and weather
mutations against the complete save document. Shared raw-document helpers keep
production and experiment rules aligned. Date copies, host statistics, weather
flags, ordinary choices and watering provenance commit and undo together.
A differential test compares the production proxy and pure adapter over the same
sequence; failed groups preserve both domain state and redo.

Target bindings use location names, soil coordinates or building IDs plus exact
non-watering fingerprints. They survive cloning and array reordering. This is a
fixed-topology prototype: ambiguous targets and unannotated content/topology
changes fail before publication. Byte-identical replacement at the same key is
not detectable from XML alone. Future farm operations must explicitly maintain
identities and invalidate provenance. Fingerprint snapshots count toward the
history byte budget; they are not a heap optimization.

The complete calendar/history runtime graph runs directly on Node 24. Its
TypeScript configuration permits legacy enums reached through type-only save
interfaces; the runtime graph remains enum-free and is exercised by native tests.
The older plain/Effect comparator sessions do not implement calendar actions.
The production application remains proxy-backed. The complete Effect/Atom editor
workflow now runs at `http://127.0.0.1:5190/?flow=editor` after starting the lab.
It includes calendar drafts/weather, history/net review, one vanilla bundle
completion, undo/redo and export/reimport. See [workflow evidence and reproduction](../../docs/v2-workflow-proof.md).

## Transaction annotation investigation

`transaction-annotations.ts` proves scoped, inheritable review metadata without a
union of every domain action. A transaction-local journal stages successful records;
three tests cover nesting, typed domain failures, failed groups and concurrent
isolation. It does not replace the document/history commit boundary yet.
See [adapter and annotation findings](../../docs/v2-adapter-and-annotations.md) for
how this can fit `effect-atom-svelte`, and the package's ownership/command caveats.
