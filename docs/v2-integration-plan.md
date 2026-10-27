# V2 integration plan

## Destination and working decisions

`main` remains the release branch. `v2` starts from `main` and receives reviewed,
focused feature PRs. PR #180 is merged into `v2` as the foundation. Bring `main` fixes into
`v2` regularly. Keep ordinary release fixes independently reviewable on `main`.
The initial foundation belongs to the existing V2 editor foundation milestone.

Proceed with Effect for session/application services, explicit operations,
transactional history and resource ownership. Use Atom for feature read models;
retain Svelte presentation, shared native controls and Bits where compound
interactions justify it. Preserve imported save data and existing format/domain
knowledge through adapters. These are integration defaults, not claims of complete
production readiness or a commitment to rewrite all format knowledge.

The visible editor is still proxy-backed. The Effect engine and its inventory
lab are separate proofs. Every editing session must have one authoritative commit
path; old writable proxies cannot silently bypass V2 history. A separate legacy
entrypoint can remain available while V2 workflows migrate.

## Evidence carried by #180

- Explicit operations, draft conflicts, atomic document/identity/domain-state
  history, undo/redo, bounded retention and baseline net changes.
- Item reorder, placement, removal and empty-slot transfers across backpacks.
  Catalog-driven construction, merging and other containers remain work ahead.
- Transactional calendar preparation, dependent weather/watering provenance and
  production/experiment parity over shared rules.
- A responsive visual shell, directly editable pixel assets, shared controls and
  native/Bits confirmation comparison. The generic row/column container is still
  a candidate, not a required abstraction for the next workflow.
- Tooling/CI foundation and targeted lifecycle repairs. Full heap/lifetime safety
  and end-to-end Effect UI integration are not established by those repairs.

## Bounded foundation proofs

The four proofs below now have implemented evidence in the separate editor lab.
See [workflow results and the migration decision](v2-workflow-proof.md) for commands,
coverage, measurements and remaining lifetime/release gates. These acceptance criteria
remain the boundary for this stretch; they do not certify the legacy application.

### 1. Calendar as a complete Effect-backed workflow

Rough size: medium; start here. Depends on the foundation session and existing
calendar adapter, not a full inventory migration.

Connect import, the redesigned date/weather controls, feature read models,
operation commits, undo/redo and export to the same Effect session. Keep the
current field draft/validation behavior and existing Stardew-specific rules.

Acceptance:

- Editing year, season, day and ordinary/forced weather produces intentional
  commits. Invalid input/failure leaves document, domain state and history intact.
- Undo/redo restores multiplayer date mirrors, statistics, remembered ordinary
  choices and watering provenance together. Dirty drafts have explicit conflicts.
- Export/reimport preserves unknown/modded data and produces only expected save
  changes. Loading/viewing does not silently mutate the imported baseline.
- Keyboard and narrow-screen interaction works through the production-style UI.
- The selected workflow has one write authority; any legacy coexistence boundary
  is explicit and covered by preservation checks.

### 2. A small understandable history and net-change view

Rough size: medium. Builds on the calendar workflow and existing inventory lab.
Feeds #168; a complete change-review product is not required for this proof.

Acceptance:

- Simple/compound actions identify their affected farmer or context. Compact
  reorders remain inspectable without dominating the primary review.
- Repeated edits, return-to-baseline, no-ops, interleaving, undo and redo branching
  have visible, documented outcomes. Action history and net changes are distinct.
- Baseline comparison exposes actual changes outside recorded operations and
  remains meaningful after history eviction. Truncation is communicated.
- Selective revert and persistent history are explicitly deferred unless separate
  evidence supports them.

### 3. Browser lifetime and performance evidence

Rough size: medium to large because findings may require ownership changes.
Feeds #169; can investigate the current session while calendar integration proceeds.

Acceptance:

- Repeated import/edit/navigate/replace/close cycles include icon-heavy views,
  failed creation/import and cancellation where applicable.
- Instrumented roots/subscriptions/workers return to their ownership baseline.
  Retained heap trends are measured across repeated cycles, with GC/transient
  allocation limits and unresolved coverage documented.
- Ownership transfer does not dispose still-live resources or retain abandoned
  state. Existing convenient APIs are judged by observed ownership outcomes.
- Full-save copying/diffing, startup/loading and interaction costs are measured on
  representative saves. Browser emulation is distinguished from physical mobile
  hardware; serialized history limits are not described as heap limits.

### 4. One second-domain compound operation

Rough size: medium. Use one vanilla bundle completion, building on the session
and field/action contracts. Broad bundle editing is a later feature task.

Acceptance:

- Preparation coordinates the selected bundle's required linked flags/rewards
  using domain rules. Failure publishes none of those changes.
- Undo/redo reverses the whole operation. Export/reimport preserves unrelated and
  unknown save data; affected changes match its recorded intent.
- Confirmation/result interaction has accessible names, keyboard cancellation,
  focus restoration and narrow-screen behavior.
- Any contract changes are justified by this domain rather than generalized from
  stack editing alone. General farm topology/identity remains a separate gate.

## Migration and release boundary

Use those proofs to finish the architecture decision in #171 and define focused
migration tasks with requirements, dependencies, preservation checks and rollback
criteria. Supported workflows need an explicit coverage matrix before a V2 release.
The first release milestone must be bounded; it does not inherit every discovery
feature request or require a one-to-one UI port.

Catalog construction/merging, additional inventory containers, farm identity
maintenance, lazy catalog/locale boundaries, broader compound selection, and
feature tasks such as pets/children/platform export stay visible as follow-ups.
They do not expand this foundation PR automatically. The existing milestone and
project retain that backlog. Retire a legacy path only after its supported data
and interaction cases pass through the replacement.
