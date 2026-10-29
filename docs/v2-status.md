# V2 status and working conventions

This is the current entry point after migrations through #200 (`10b0619`) and
the quality cleanup following #194. Earlier audit reports are dated snapshots,
not active migration checklists.

## Application coverage

The application-owned `/v2` editor includes import/export, history and review,
calendar/weather, farm settings, inventory and equipment, item catalog/properties,
Character skills/professions/mastery, Character details, relationships, appearance,
recipes, events, quest journals and Qi special orders. Inventory respects actual
backpack capacities and supports placed chests and transfers.

Remaining migration work includes buildings/animals, full Community Center and
Joja workflows, and farmhand reassignment. General special orders beyond the Qi
workflow and the remaining inventory sorting/storage workflows need explicit
coverage checks before being counted complete. Stack splitting/merging remain
deferred. A visual pass follows the functional work; this cleanup does not replace
that review.

## Extension contract

Use [domain views and immediate fields](v2-domain-fields.md) for independent edits:
valid writes publish immediately, while text/number gestures create one net Undo
entry and end on blur. Explicit drafts belong to coordinated consequences such
as the calendar. Domain adapters own saved representations and validation;
fallible work uses Effect, expected failures remain typed, and defects reach the
shared reporting boundary. Pure arithmetic and projections stay plain code.

Use `bindImmediateField` with narrow editing ports instead of repeating gesture
plumbing. Shared farmer selection is session state, independent of feature
availability. Inventory mutations prepare records and instance identities
together; history publishes that prepared result atomically.

## Quality follow-ups

The [independent cleanup audit](v2-cleanup-audit.md) verifies the completed field,
transition and error-boundary cleanup and identifies systemic residual concerns.
The [performance profile](v2-performance-profile.md) includes reproducible inputs,
raw measurements and source fingerprints. Grouping Undo does not eliminate the
cost of each immediate write.

- [#201: measured editing latency and performance budgets](https://github.com/colecrouter/stardew-save-editor/issues/201)
  owns remaining whole-save work and active-gesture memory accounting.
- [#202: inventory controllers and legacy metadata adapters](https://github.com/colecrouter/stardew-save-editor/issues/202)
  owns panel composition, repeated metadata casts and clearer request/prepared-action boundaries.

These remain actual work, not implied completion of all audit concerns. The
owner's planned XML/parser/raw-type replacement is separate; avoid broadening
these tasks into a replacement type system.

For validation commands, see [CONTRIBUTING](../CONTRIBUTING.md). The
[implementation requirements](v2-implementation.md) and
[editor blueprint](v2-editor-blueprint.md) provide the wider migration context.
