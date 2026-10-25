# Inventory Atom versus store comparison

## Result

Effect Atom is a viable presentation/read-model layer over the transactional session.
The prototype does not establish a compelling reason to replace every existing proxy
with atoms. Adopt it selectively in a complete migration slice, keeping save data and
history authoritative in the session and extracting game rules from proxy effects.
The small store bridge remains a credible alternative for simple synchronous views.

The same Svelte inventory panel runs against both implementations. Both support
farmer/slot selection, stack edits, undo/redo, and compact backpack reordering. Neither
exports a writable save/document atom. The convenient stack field setter captures
farmer, slot and expected item ID, then executes a domain mutation. Selection changes
after submission cannot retarget it. UI selection is ephemeral and creates no history.

## Implementations

`inventory-atoms.ts` creates a scoped AtomRegistry, a read-only history stream atom,
derived inventory/selection/undo views, and Atom.fn command results. A writable stack
atom routes its write into the command; it does not write through to raw data.
Read-only Svelte store adapters let the panel consume these values without a separate
atom/Svelte integration library or a second writable save graph.

`inventory-stores.ts` consumes the same history service. It explicitly bridges a scoped
stream fiber into readable state, derives views, tracks command errors, and implements
a distinct-value wrapper. Both implementations need equality comparisons to avoid
unnecessary object notifications after full-document copies. Atom provides an equality
option; it does not automatically know which save fields a domain view depends on.

The Atom version centralizes command result state and dependency/cache ownership.
The store version requires more explicit subscription/error plumbing, but the complete
small implementation is similarly sized and its Svelte integration is direct. This is
evidence of viable composition, not a claim of reduced total code or faster rendering.

## Findings addressed during the experiment

- When an evicted view remounts after edits elsewhere, it must read the current session
  while reconnecting. Both models were adjusted to avoid displaying the constructor's
  stale initial snapshot.
- Effect 4.0.6 derives a zero timer resolution from defaultIdleTTL: 0, causing a NaN
  timeout warning. The prototype supplies an explicit positive timeoutResolution.
- Command results hold no returned save snapshot: Atom.fn maps successful mutations
  to void. Domain/history state stays in the session.
- The panel is keyed by session and explicitly captures that session's stores. Its
  native controls retain keyboard behavior, accessible labels and visible focus.

## Evidence

Twelve paired model tests cover both implementations: real-save edit/export preservation,
history/undo/redo, invalid and unsupported slots, captured targets, suppressed unrelated
notifications, and repeated consumer/session cleanup. The real fixture edit changes only
the selected object's stack and survives production-codec export/reparse.

Changing money produces no inventory notification. Editing another inventory item
produces no selected-item notification. Ten consumer teardown/remount/session-close
cycles per implementation leave zero tracked streams; the Atom registries also have
zero nodes after closure. Remount tests include edits performed with no active view.
These are deterministic resource-count checks, not heap or existing item-proxy tests.

All 41 experimental tests pass: 8 native Node tests and 33 Effect/Vitest tests. The lab's
Svelte check reports zero errors/warnings, its build succeeds, formatting passes, and
the isolated dependency audit reports zero vulnerabilities.

Collaborative-browser validation at http://127.0.0.1:5190 checked the same panel in
both modes: stack edit, undo/redo, reordering, host/guest switching, Enter submission,
native invalid-range rejection without an extra action, visible keyboard focus, and
absence of an error overlay. No new warning/error appeared in the final interaction
window. Desktop was 1280×900; a 390×844 viewport had no horizontal overflow. Transient
development reload errors occurred while source/config files were being edited; a
fresh final navigation passed. This is Chromium preview validation, not iOS Safari.

## Costs and limits

Paired standalone browser bundles are measured with the same esbuild command. The
Atom inventory factory is approximately 77 KB gzip versus 58 KB for the store factory,
about 18.5 KB more. These are synthetic entry bundles, not incremental production-app
downloads. The combined lab build includes both paths and uses a different bundler;
its size must not be added to the paired measurements.

The read stream still copies session state and recomputes projections. Atoms suppress
notifications after equality checks; they do not remove that copying/comparison cost.
Large-save render/typing performance and session-to-worker transfer still need profiling.
The Atom APIs are currently marked unstable; pin versions and keep the boundary small.

Stack editing deliberately supports ordinary Object entries with a numeric stack and
a prototype range of 1–999. It does not implement every modded stack limit, equipment,
item creation or durable identity for duplicate items moved between slots. The panel
uses a synthetic inventory fixture; the model separately tests the real save fixture.
No icon proxy or asset pipeline was replaced, and existing proxy heap behavior remains
part of #169. UI primitive/design choices remain part of #170.

## Reproduce

Install root and experiment dependencies, then run from the repository root:

```sh
npm test --prefix experiments/v2
npm run check:ui --prefix experiments/v2
npm run lab:build --prefix experiments/v2
npm run lab --prefix experiments/v2
npm run measure:bundle --prefix experiments/v2
```

The lab is local-only and uses isolated Svelte 5.55.7/Vite tooling. It does not change
the production routes or introduce Atom into the production bundle.

Sources: [Atom API](https://effect.website/docs/v4/api/effect/reactivity/Atom),
[AtomRegistry API](https://effect.website/docs/v4/api/effect/reactivity/AtomRegistry),
and [Svelte stores](https://svelte.dev/docs/svelte/stores).
