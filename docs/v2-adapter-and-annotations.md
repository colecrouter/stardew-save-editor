# Svelte Atom adapter and transaction annotations

## Findings

`effect-atom-svelte` is a credible replacement for the Svelte-facing Atom bridge,
not a replacement for the transactional session. Its current 0.4.1 package peers
match Effect ~4.0.0 but require Svelte ^5.57.2; the original experiment pinned 5.55.7.
The initial pass inspected the upstream implementation. The follow-up adapter branch
now installs Svelte 5.57.2 and effect-atom-svelte 0.4.1 in the experiment only, with
matching compiler/plugin/runtime dependencies. Root application dependencies stay unchanged.

The most useful detail is external registry support. `RegistryProvider` accepts an
existing registry and leaves disposal to its owner. We can provide the session's
registry beneath the keyed file workspace, keep its Effect scope authoritative,
and use the package for Svelte subscriptions. Provider props are read once: switching
files must remount the provider rather than replace its registry prop in place.
Avoid its implicit shared browser registry for save-specific state.

| Capability                              | Value for this editor                                                        | Boundary to retain                                                                  |
| --------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `useAtomValue` and selected projections | Reactive `.current` values replace handwritten component/store subscriptions | Read committed feature projections, not a writable copy of the save                 |
| `useAtomSet` with promise/Exit results  | Convenient action completion and typed result handling                       | Keep the session's command queue and revision validation                            |
| `useAtomMount` / subscription hooks     | Component-owned subscriptions and explicit background consumers              | A view unmount must not close the imported file                                     |
| `useForm` with Effect Schema            | Validation/error attributes and form state from one schema                   | Verify our dirty-draft and source-revision conflict semantics before replacing them |
| Scoped atoms                            | Feature/subtree-local state without global collisions                        | Session state must survive tab changes; view state may be shorter-lived             |
| Async result/suspense hooks             | Loading and failure presentation for imports and lazy assets                 | Do not make a file mutation restart just because UI reevaluates                     |
| Inspector                               | Registry/atom visibility during lifetime investigation                       | Diagnostics supplement measured teardown/heap evidence                              |
| SSR/hydration and RPC/HTTP helpers      | Available for future server-facing features                                  | Not a reason to add servers to a local save editor                                  |

A particularly important command detail: the source documents that promise setters
on a single `Atom.fn` share its current result. A newer invocation supersedes the
older one; pending callers can receive the latest invocation's result. Also, aborting
the setter's wait does not necessarily interrupt an already-running atom. These are
useful semantics for queries but cannot silently replace serialized save commits.
The session must determine what committed, and explicitly own interruption on close.

The smallest meaningful integration experiment is the existing calendar workflow:
upgrade the experiment's Svelte version with compiler/runtime resolution checked,
provide its existing registry, replace view subscriptions with `useAtomValue`, and
compare navigation/remount, dirty conflicts, concurrent commands, close-during-work,
and repeated file replacement against the current tests. Keep existing command
execution initially. Evaluate `useForm` and action atoms separately after that proof.
Do not simultaneously replace validation, history and ownership or we lose the
comparison's ability to explain a regression.

## Metadata does not require an action union

Yes: custom Effect context annotations can describe intent without defining every
domain command in one union. Three separate concepts should stay distinguishable:

- A domain function has its own typed input and typed failures.
- A scoped annotation supplies review information such as label, emphasis, tags and
  affected context. Child operations inherit it and may override selected fields.
- The transaction captures actual document/identity/domain-state differences and
  commits a detached metadata record with them. Metadata does not establish what
  changed or prove that an operation succeeded.

`transaction-annotations.ts` began as an executable isolated proof using `Context.Reference`
for immutable ambient metadata, a transaction-local journal service and `Effect.fn`
for named execution. It supports feature-defined string tags without adding any
action variants. Its three tests establish nested inheritance/sibling isolation,
preserved tagged domain failures, failed-group discard and concurrent journal isolation.

Conceptually, a feature can write:

```ts
yield *
	recordAnnotatedOperation(completeBundle(input)).pipe(
		withReviewMetadata({
			label: "Complete Spring Foraging",
			emphasis: "standalone",
			tags: ["community-center", "bundle-completion"],
		}),
	);
```

The shared runner need not understand `input` or enumerate bundle/calendar/inventory
commands. Review emphasis is a small shared presentation vocabulary; it is not a
union of all possible actions. If annotations need richer typed extension data,
feature-local typed keys and registered serializable projections can extend this
approach without turning every tag into an unchecked object cast.

For durable history, copy a validated, serializable metadata projection into the
entry. Do not retain Context objects, closures, Effects or service references there.
Tracing spans and logger annotations remain useful diagnostics, but tracing can be
disabled/sampled and is not the authoritative user review journal. `Effect.fn` names,
error `_tag`s, and review tags therefore have different responsibilities.

## Integration constraints

The initial proof staged metadata only. The follow-up below now integrates its journal
with the authoritative history commit.
Its mutable journal is private to one collection; it must not be shared across
transaction retries. Production integration should stage records inside the same
prepared state/transaction attempt as document patches, publish once on success,
and discard them on failure or interruption. An operation can still perform unsafe
external writes; annotations do not make those rollbackable.

Annotate public operations and meaningful substeps; do not automatically create a
review row for every internal helper. A root transaction can group child records,
with compact operations inspectable beneath it. Root/child emphasis precedence is
an explicit review policy, not something a tracing span hierarchy decides for us.
An unannotated write must remain visible through actual patch/net review.

The existing `Mutation` union currently also drives identity handling and records
typed command data. Removing it outright would lose those behaviors. Migrate toward
domain-local typed functions plus explicit staged identity services; keep command
schemas only where validation, inspection or future replay actually needs them.
Current redo applies stored patches, so it does not require rerunning a universal
command union. History should not dispatch every domain operation itself.

## Sources and reproduction

- [Package and peer requirements](https://github.com/jarrednorrisdev/effect-atom-svelte/blob/main/packages/effect-atom-svelte/package.json)
- [Registry ownership implementation](https://github.com/jarrednorrisdev/effect-atom-svelte/blob/main/packages/effect-atom-svelte/src/RegistryContext.ts)
- [Provider remount behavior](https://github.com/jarrednorrisdev/effect-atom-svelte/blob/main/packages/effect-atom-svelte/src/RegistryProvider.svelte)
- [Hooks, command results and form integration](https://github.com/jarrednorrisdev/effect-atom-svelte/blob/main/packages/effect-atom-svelte/src/Hooks.svelte.ts)
- [Package overview](https://github.com/jarrednorrisdev/effect-atom-svelte)

The annotation proof uses the installed Effect 4.0.6 APIs. Run native type checks,
Effect diagnostics and `transaction-annotations.effect.ts` with the experiment's
Vitest config. The original research pass did not install the adapter. The implementation below
records the follow-up integration and its verification.

## Adapter implementation and result

The complete editor workflow now provides its Effect-owned registry through a
keyed `RegistryProvider`. Calendar, bundles, review and workspace controls read
read-only atoms with `useAtomValue`; `.current` stays reactive without duplicating
the preservation document. The old readable interfaces remain for headless tests
and the existing generic draft/field contract, not as another writable state graph.

The command queue, revision guards, draft conflicts, XML codec, transaction/history
and explicit close ownership are retained. No Atom.fn command migration, useForm
rewrite or suspense/SSR integration is included. New Svelte types exposed two
compile-time assumptions: heterogeneous test subscriptions now have an explicit
read-only observation type, and reorder captures one projection before building
its permutation instead of repeatedly reading a potentially-changing accessor.

Borrowed registry disposal requires an ordering boundary. Svelte consumer hooks
must unmount before the Effect owner disposes the registry; disposal is not a
final reactive "closed" emission. Closing the registry with live readers reproduced
an access-after-dispose error. File close/replacement now clears the workspace,
awaits `tick()`, then closes the scope. Parent teardown captures its session and
closes after child teardown. The provider never disposes the borrowed registry.

`adapter-proof.mjs` mounts/unmounts the provider ten times around the same file,
edits while all consumers are absent, and verifies fresh values on remount and a
still-live single model/registry/stream. Owner close then returns all counters to
zero without browser errors. Its small harness is imported only by the development
proof, not by the lab application entrypoint. Invoke it through Playwright CLI's
`--filename` using the same export-to-function conversion as `ui-proof.mjs`.

The existing 93 experiment tests pass with the upgraded experiment Svelte. Native
and Svelte checks, Effect diagnostics, formatting and the lab build also pass.
The full UI proof covers import/edit/conflicts, native dialog focus/cancel,
export/reimport, narrow widths and repeated file close; its samples are recorded
separately from the pre-adapter baseline. These checks support adopting the read
bindings. They do not establish every package feature or eliminate the previously
recorded UI heap measurement limitations.

## Domain/history implementation

`session.transact(program, expectedRevision?)` now executes typed Effect programs
inside the same transactional update as the legacy `execute(actions)` API. Error
and environment types are inferred from each program rather than listed in an
all-domain union. `Effect.fn` names the calendar and bundle operations; portable
calendar planners remain shared ordinary TypeScript. Legacy command adapters map
errors only at their compatibility boundary.

The editor's calendar field, weather selectors and bundle confirmation now call
`model.transact` with domain-local functions. `CalendarStateInvalid`,
`CalendarRuleViolation`, `BundleUnavailable`, `BundleProgressInvalid` and
`BundleMailInvalid` retain their tags through the runner, so callers can use
`Effect.catchTag` without parsing a string or adding variants to a shared error type.
The older inventory comparison and compact reorder continue to use the identity-aware
legacy command adapter.

A `TransactionDraft` capability supplies a detached snapshot and versioned replacement.
The operation validates/prepares that snapshot, then records its successful staged
replacement under scoped review annotations. A sibling staging against an older
version fails instead of overwriting another child. Each transaction attempt owns a
fresh draft and journal; both become inactive when the program finishes, including
failure/interruption. Captured capabilities cannot stage or append after that boundary; cleanup also
clears their internal document/journal buffers so retained service handles do not
retain an abandoned save.
Program code must await its mutations; starting an unjoined child is not an alternative
commit path.

One shared history finalizer derives real forward/reverse patches, detaches state,
applies the undo byte/entry budgets and commits document, identities, domain provenance
and annotations together. Annotations count toward the byte budget and must pass
plain-JSON/metadata validation. No-op programs create no entry; calendar and bundle
no-op children also omit misleading annotations from a group with other real edits.
Failures preserve revision, history, redo and all document/domain state.

`Entry.annotations` records successful operation metadata. Labels from standalone
operations form the primary group label; compact records remain inspectable. The
review panel exposes operation labels/tags separately from actual save-field patches.
Annotations explain intent and are not trusted as a complete change list. Unannotated
writes remain prominent, and net review still compares against the original import
after undo-history eviction. These records live in session history; they are not
exported to game XML or persisted between file sessions.

New domain functions need no entry in `Mutation`. A test-only feature outside that
union commits a typed program and tags through the same runner. The remaining union
serves legacy command/identity dispatch and compatibility tests, not the new metadata
system. Until explicit identity capabilities migrate, the Effect-program path rejects
inventory record/owner changes rather than keeping stale item handles. Calendar's
fixed-topology provenance limits also remain; this work does not authorize arbitrary
farm object replacement.

`domain-transactions.effect.ts` adds twelve tests: extension without a new action
variant, grouped calendar/bundle export, undo/redo, no-ops, typed failures and late-mail
rollback, failed/interrupted group rollback, stale revisions/sibling conflicts,
concurrent retry journal isolation, metadata validation/byte limits, eviction/net
review, retained-reference isolation and expired capabilities. All 105 experiment
tests pass (11 native Node and 94 Effect/Vitest). Type/Svelte checks, Effect diagnostics,
formatting and lab build pass. The browser proof additionally checks operation-tag
presentation and repeats the complete import/edit/review/undo/export/close workflow
thirty times, with all tracked resources and export URLs released after every close.
[Raw observations](../design/v2/domain-measurements.json) retain the same measurement
limits as the earlier runs; they are not controlled performance comparisons.

Next migration gates remain bounded: explicit inventory identity capabilities, a
supported production entrypoint, broader failure presentation and real-device checks.
The bundle sample retains its bounded vanilla coverage; broader Joja-route and
bundle compatibility remain future domain work. A persistent command/replay schema is a separate need; it is not required to tag or
review a new typed operation today.
