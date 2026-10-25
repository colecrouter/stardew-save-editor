# Mutation execution experiment (#167)

This is an isolated, runnable experiment. It does not change the editor, introduce
Effect into its production bundle, or decide the V2 architecture. Install the root
dependencies first; the fixture harness reuses the root XML parser dependency and
production array-recognition tables.

```sh
npm ci
npm ci --prefix experiments/v2
npm run check --prefix experiments/v2
npm test --prefix experiments/v2
npm run demo --prefix experiments/v2
```

On PowerShell installations that block `npm.ps1`, use `npm.cmd`.

## What runs

Both executors use the same domain implementation and draft/commit protocol:
change one farmer's money, rename the farm across farmers, and reorder every
backpack slot. The two executors must produce identical documents and receipts.
Full-save export/reparse uses the existing 6.65 MB `tests/TestSave`; a small
multiplayer fixture covers shared naming and individual targeting. Unknown item
data, nil markers, and Secret Notes move intact.

The money operation is a field-edit experiment, not a complete money API:
shared-wallet reconciliation is intentionally unimplemented. Farmer IDs are
resolved at execution time and must be unique. Backpack references are whole-slot
permutations, not persistent item identities across asynchronous commands.

`prepare` clones the current document, validates and applies one mutation, computes
changes, and returns the next document/history together. Publication happens only
after preparation succeeds. A fault injected after compound writes verifies that
failure publishes neither partial state nor history. No-op edits produce no receipt.
Reordering carries `review: compact`; its changes are still recorded.

Effect 4.0.6 supplies a private `SubscriptionRef`, serialized effectful updates,
typed failure, scoped finalization, and consumer fibers. The plain implementation
uses synchronous preparation and an explicit session close. Their application
semantics are deliberately identical; the plain implementation does not claim
equivalent asynchronous scheduling or subscription management.

The Effect session exposes a minimal Svelte store contract: an immediate snapshot,
subsequent snapshots, and unsubscribe. The consumer fiber also belongs to the
session scope. Tests cover this contract without introducing an atom adapter or a
second writable state graph. A view receives copies; it cannot mutate the session.
This is a Node experiment (the diff uses `node:util`), not a browser-ready adapter
or a rendered component integration test. Notifications are snapshots, not a
durable event log; a slow consumer must read history from the latest state.

## Results and recommendation

A local run on Node v24.11.0, Windows, using ten alternating-order rounds:

- Parsing the full fixture: 413 ms.
- Construct session and execute all three mutations: plain median 101.7 ms
  (99.6–108.4 ms); Effect median 105.0 ms (102.0–115.7 ms).
- Export: 2,753,206 bytes; parsed exported data equals the edited document.
- Eight experiment tests pass, including concurrency, failure atomicity, targeting,
  opaque-data preservation, store contract, and session closure.

These timings include full-document copies, diffing, and returned snapshots, but
exclude parsing, export, UI rendering, startup/module loading, and mobile hardware.
They are descriptive measurements, not a statistically supported performance
comparison. The full fixture has no farmhands; the compound multiplayer behavior
is separately demonstrated on the small fixture. Original XML formatting/BOM is
not preserved by this harness; parsed-data preservation is the assertion.

Explicit mutations are viable without replacing Svelte. Effect's marginal runtime
cost in this sample is small relative to copying and diffing; this does not establish
browser bundle or mobile cost. Effect makes serialization, failure composition,
and scope ownership available together. It does not supply intent labels, review
policies, save validation, undo, or rollback of ordinary JavaScript writes. Those
are custom domain responsibilities in both versions.

Proceed with the review and lifetime experiments using this boundary. Defer an
Effect-wide migration until they demonstrate enough value to justify the additional
runtime concepts. A synchronous operation core with an optional Effect execution
layer remains a viable outcome. Full-save cloning is simple evidence of atomicity,
not yet a suitable choice for every keystroke: evaluate structural sharing, patches,
field-commit boundaries, and history limits before production adoption.

## Remaining questions

- Undo/redo, selective revert, net-change review, and tag policy belong to #168.
- Resource stress/heap evidence and actual item-proxy acquisition belong to #169.
  Closing the prototype's scope does not prove the existing editor is leak-free.
- Rendered Svelte integration, subscriber error handling, browser/mobile bundle
  size, worker transfer, and cancellation during asynchronous preparation remain
  unproven. The current preparation is synchronous; fibers cannot interrupt its
  clone/diff work midway.
- Unknown fields survive the exercised operations, but this is not a complete mod
  compatibility claim. Arrays are recorded as whole values; a production review
  needs semantic grouping and stable identity. JSON pointer paths alone are not
  persistent domain identities.
- The observer hook is fault injection/final validation, not a plugin API. Reentrant
  edits from validators are unsupported. Session history is unbounded in this spike.

## Sources

- [Effect SubscriptionRef API](https://effect.website/docs/v4/api/effect/SubscriptionRef)
- [Effect resource scopes](https://effect.website/docs/v4/resource-management/scope)
- [Svelte store contract](https://svelte.dev/docs/svelte/stores)
- [Svelte effect lifecycle](https://svelte.dev/docs/svelte/$effect)

Versions are pinned in the experiment lockfile. No Svelte adapter library has been
selected. See [the audit](../../docs/v2-discovery.md) for outcomes and baselines.
