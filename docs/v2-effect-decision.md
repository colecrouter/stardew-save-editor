# Effect adoption recommendation

## Decision

Recommend Effect for the editor's session/application layer through incremental,
complete vertical slices. The expanded experiment supplies enough evidence to choose
that direction. It does not justify translating every UI binding or data structure
into Effect or approving a wholesale rewrite.

The initial mutation wrapper did not distinguish Effect strongly from plain TypeScript.
The combined workflow does: typed dependencies, replaceable runtime layers, mutation
execution, resource ownership, interruption, Schema and scoped tests work together.
These capabilities match recurring problems better than individual UI conventions.

## Evidence and boundaries

The isolated package uses Effect, platform-node and @effect/vitest 4.0.6, plus Vitest
5.0.5. Their peer requirements were checked rather than assuming Effect 3 examples
still apply. Production dependencies and the root Vitest 3 suite remain separate.

- The production codec runs behind Comlink and an Effect service. Equipment types,
  array recognition, text normalization and BOM output are shared, not duplicated.
- NodeServices and NodeRuntime compose read/decode/edit/encode/reparse and scoped
  temporary output. Tests replace filesystem/codec layers without module mocking.
- Invalid XML, incomplete compression, envelope errors and versions have explicit
  typed failures. An envelope projection validates known fields but does not replace
  the full parsed data, avoiding accidental stripping of unknown fields.
- Actual workers terminate after successful operations and interruption; ten canceled
  requests leave zero tracked workers. This is not a claim that all existing proxies
  or browser workers are leak-free.
- Effect.tx commits prepared document/history refs together. JSON Patch supports
  forward/reverse changes for linear history. Intent and review grouping remain ours.
- A Svelte store contract works without adopting another writable reactive graph;
  browser bundling succeeds for the session and codec entries.

Tests, reproduction and measurements are in [the experiment README](../experiments/v2/README.md).

## Architecture

The editing session owns authoritative document/history state and resources. UI submits
intentional mutations and reads projections. Operations define stable targets, validation,
dependent writes, optional review tags and reversible changes where supported.

Read models can retain convenient proxies/constructors. Temporary view/search resources
need scopes or bounded caches shorter than the entire session lifetime. Existing Dispose
hooks can be registered with scoped acquisition; #169 must verify actual item creation,
ownership transfer, view churn and heap retention. No prohibition on display proxies follows.

Use services for replaceable capabilities and owned resources: codec/worker, files,
persistence, session operations. Keep pure game rules ordinary TypeScript where clearer.
Execute Effects at platform/application/UI boundaries rather than scattering runtime calls
through domain functions.

Transactions cover Effect-managed state. A failed transaction does not undo an object
mutated in place after reading it from a ref, nor file writes or worker messages. The
prototype tests the unsafe object case. Existing proxy setters therefore need drafts,
immutable updates or extracted operations; merely wrapping them in Effect.tx is insufficient.
SubscriptionRef is adequate for one aggregate document/history value. TxRefs become
useful when several independent state cells need atomic publication.

Review tags control emphasis, not existence. Quiet reorders retain evidence. Patches
cannot infer intent; final net changes can be empty after meaningful actions. #168 still
owns presentation policy and selective-revert dependencies.

## Costs and limits

Standalone browser bundles measure about 57 KB gzip for the Effect session versus
1 KB for plain TypeScript; the codec service is about 140 KB including XML/compression.
These are not incremental app sizes and must not be added together. Bundle size and
learning layers, typed errors, fibers and scopes are real adoption costs.

Similar mutation timings on Node do not establish mobile performance. Copies/diffs
dominate this sample. Bound history, select input commit granularity and profile browser
rendering/transfers. Effect interruption does not preempt synchronous parsing on a
thread; terminating its worker provides that boundary. A worker per request proves
cleanup but is not a recommended production pool.

No Svelte adapter is selected. Registry metadata for effect-atom-svelte 0.4.1 requires
Svelte ^5.57.2; this checkout resolves 5.55.7. @thomasfosterau/effect-svelte 0.6.0 declares
compatible peers. They remain candidates, not prerequisites; the store contract already
demonstrates basic interoperability. Neither metadata compatibility nor bundling proves
rendered UI correctness. A second reactive graph needs its own justification.

## Node 24

The experiment runs native TypeScript with no tsx. Explicit .ts imports, type-only imports
and erasable syntax make this possible; typechecking remains separate. Node ignores
tsconfig path aliases and does not compile Svelte runes or transform enums, parameter
properties and runtime namespaces by default. Experimental transform-types handles some
non-erasable syntax but does not replace the Svelte toolchain.

Root codegen still has enums and extensionless imports, so keep its tsx runner until a
separate migration is justified. Root CI jobs remain on Node 22; a new experiment job
uses Node 24. Local tests use 24.11.0; current Node docs mark stripping stable from 24.12.0.

## Next sequence

The subsequent history experiment implements bounded linear undo/redo in a
TxSubscriptionRef with JSON patches. It verifies that document/cursor/history updates
participate in outer Effect transactions, while compact review tags remain independent
of actual patches. This strengthens the mechanism recommendation; byte budgets,
selective revert, persistence and UI policy still need design. See history.ts and its
tests in experiments/v2.

1. Finish #168's review policy and bounded linear undo prototype, including a baseline
   versus export completeness check.
2. Finish #169 against real item/view/session lifetimes with heap evidence and failed
   ownership transfer cases.
3. Migrate one full production workflow: import, inventory mutation, review/undo, export,
   close. Measure browser/mobile responsiveness and incremental app bundle size.
4. Keep #170's UI primitive choice independent; use #171 to record accepted production
   decisions and migration tasks.

This recommendation chooses a direction without declaring those production acceptance
criteria or later discovery issues complete.

## Sources

- [Node 24 TypeScript](https://nodejs.org/docs/latest-v24.x/api/typescript.html)
- [Effect platform](https://effect.website/docs/v4/platform/introduction)
- [FileSystem](https://effect.website/docs/v4/platform/file-system)
- [TxRef](https://effect.website/docs/v4/api/effect/TxRef)
- [JSON Patch](https://effect.website/docs/v4/api/effect/JsonPatch)
- [SubscriptionRef](https://effect.website/docs/v4/api/effect/SubscriptionRef)
- [Effect Vitest](https://github.com/Effect-TS/effect/tree/main/packages/vitest)
- [Effect Node platform](https://github.com/Effect-TS/effect/tree/main/packages/platform-node)
- [Atom Svelte adapter](https://github.com/jarrednorrisdev/effect-atom-svelte)
- [Alternative Svelte integration](https://github.com/thomasfosterau/effect-svelte)

Installed declarations and registry peer metadata were also checked locally.
