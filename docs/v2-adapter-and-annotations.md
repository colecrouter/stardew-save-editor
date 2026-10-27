# Svelte Atom adapter and transaction annotations

## Findings

`effect-atom-svelte` is a credible replacement for the Svelte-facing Atom bridge,
not a replacement for the transactional session. Its current 0.4.1 package peers
match Effect ~4.0.0 but require Svelte ^5.57.2; the experiment pins 5.55.7.
This pass inspects the upstream implementation, rather than installing with ignored
peers or claiming an untested integration works.

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

`transaction-annotations.ts` is an executable isolated proof using `Context.Reference`
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

This proof stages metadata only and deliberately does not replace history yet.
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
Vitest config. Neither the package nor Svelte was upgraded in this research pass;
the existing application/session behavior is unchanged.
