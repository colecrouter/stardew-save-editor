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

## Complete workflow evidence

The [calendar/review/bundle workflow proof](v2-workflow-proof.md) now connects import,
Atom feature projections, Svelte controls, explicit operations, undo/redo and export
through one Effect-owned session. It confirms the incremental adoption decision.
Browser stress and a session-only control support this ownership boundary while
leaving residual UI heap growth and legacy factory lifetimes as explicit follow-ups.
The lab is separate from the production application; no broad migration is implied.

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

The initial proof selected no adapter. Registry metadata for effect-atom-svelte 0.4.1 requires
Svelte ^5.57.2; this checkout resolves 5.55.7. @thomasfosterau/effect-svelte 0.6.0 declares
compatible peers. They remain candidates, not prerequisites; the store contract already
demonstrates basic interoperability. Neither metadata compatibility nor bundling proves
rendered UI correctness. An adapter must preserve the single session authority;
it can reuse the existing registry without introducing another writable graph.

### Review follow-up: adapter and domain Effect usage

See [the adapter investigation and annotation proof](v2-adapter-and-annotations.md)
for concrete package capabilities, command/ownership caveats, and an executable
Context-based alternative to a universal metadata/action union.

The initial expanded editor used a handwritten registry-to-store bridge. That proved
interoperability, not that maintaining that bridge is preferable to the suggested
`effect-atom-svelte` package. Registry metadata was rechecked: 0.4.1 still declares
Svelte ^5.57.2 while this experiment pins 5.55.7, with compatible Effect ~4.0.0.
That compatibility gap justified deferring installation, not dismissing the adapter.
The follow-up now upgrades the experiment Svelte and adopts read bindings with a
session-provided registry; [implementation evidence](v2-adapter-and-annotations.md#adapter-implementation-and-result)
records teardown/remount verification. The comparison tests session-provided
registry ownership, navigation/remount freshness, pending/errors and teardown through
the package's own bindings. Its SSR/suspense support is not itself required here.

The current new bundle adapter also underuses Effect: synchronous throwing validation
is wrapped in Effect.try and collapsed into MutationError. Before production migration,
represent meaningful domain failures as tagged error variants and use named Effect.fn
operations for lazy execution/tracing. Preserve those variants through history's error
channel and test catchTag handling as well as rollback. An intent's review classification
is separate from a tracing span or an error tag; neither replaces the actual patches.

Shared pure calendar calculations remain useful ordinary TypeScript, because the legacy
proxy also consumes them. Effect should orchestrate validation/preparation/failure at
the domain operation boundary without forcing every arithmetic helper into Effect.
This is an outstanding experiment refinement, not evidence of complete Effect-domain
adoption. The earlier comment/readability cleanup made no adapter dependency or domain error-contract
change; the subsequent adapter PR changes read bindings only.

## Node 24

The experiment runs native TypeScript with no tsx. Explicit .ts imports, type-only imports
and erasable syntax make this possible; typechecking remains separate. Node ignores
tsconfig path aliases and does not compile Svelte runes or transform enums, parameter
properties and runtime namespaces by default. Experimental transform-types handles some
non-erasable syntax but does not replace the Svelte toolchain.

Root codegen still has enums and extensionless imports, so keep its tsx runner until a
separate migration is justified. Root CI and the experiment jobs now use Node 24. Local tests use 24.11.0; current Node docs mark stripping stable from 24.12.0.

## Next sequence

The inventory comparison now exercises Atom and the store bridge through the same
rendered Svelte panel, mutation-backed fields and transactional history. Both pass
real-save preservation and resource-count tests. Atom is viable for derived views
and command results, but this small slice does not justify a blanket proxy rewrite.
See [the comparison](v2-atom-comparison.md) for measurements, ergonomics and limits.

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

## Control and operation follow-up

See [the implementation notes](v2-controls-and-operations.md) for serialized history
byte budgets, item placement/removal/transfers, Effect domain-service replacement,
production item-root cleanup, and the calendar provenance prerequisite. The UI
consolidation is a functional validation baseline; V2 explicitly includes a
responsive redesign and does not target a one-to-one port of the current UI.
