# V2 status and working conventions

This is the current entry point after core UI porting in #217 and the initial
visual/lifecycle passes in #221–#224. Earlier audit reports are dated snapshots,
not active migration checklists.

## Application coverage

The application-owned `/v2` editor includes import/export, history and review,
calendar/weather, farm settings, inventory and equipment, item catalog/properties,
Character skills/professions/mastery, Character details, relationships, appearance,
recipes, events, quest journals, Qi special orders, buildings/animals, Community
Center/Joja and farmhand reassignment. Inventory respects actual
backpack capacities and supports placed chests and transfers.

The [building/animal migration](v2-buildings-migration.md) includes animal fields,
adoption and completed building tier changes with their progression consequences.
The [remaining UI porting checkpoint](v2-porting-parity.md) covers Community
Center/Joja, farmhand reassignment, inventory/storage parity and original backup
management. The [independent porting audit](v2-porting-audit.md) records core fixes
and nonblocking P3 follow-ups. Stack splitting/merging remain intentionally
deferred. General non-Qi special orders, pets/children, location editing and the
planned parser replacement are separate feature work. Foundation visual/device validation is owner-accepted; the deliberate application
cutover remains separate.

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

The [export review contract](v2-review-changes.md) separates typed net changes
from edit history and retains unclassified saved data in an explicit fallback.

## Quality follow-ups

The [independent cleanup audit](v2-cleanup-audit.md) verifies the completed field,
transition and error-boundary cleanup and identifies systemic residual concerns.
The [performance profile](v2-performance-profile.md) includes reproducible inputs,
raw measurements and source fingerprints. The [edit publication follow-up](v2-edit-performance.md)
records immutable internal sharing and cached review comparisons; feature-view
invalidation and browser budgets were its follow-ups.
The [domain projection boundary](v2-domain-projections.md) now removes raw item data
from components and shares immutable chest views across unrelated revisions;
the [final browser qualification](v2-performance-qualification.md) records the agreed
budgets and their qualified disposition. Grouping Undo does not eliminate the
cost of each immediate write.

- [#201: measured editing latency and performance budgets](https://github.com/colecrouter/stardew-save-editor/issues/201)
  records completed browser edit/navigation and lifecycle qualification, including
  accepted synthetic navigation exceptions and a retained cold-navigation outlier.
- [#202: inventory controllers and legacy metadata adapters](https://github.com/colecrouter/stardew-save-editor/issues/202)
  is covered by centralized metadata adaptation, feature-local interaction
  controllers, and the [inventory API vocabulary](v2-inventory-interactions.md).
  Shared containers use owner keys; request, resolved action, staged metadata and
  committed completion types have distinct names.

#201 qualification is complete; see the [final browser report](v2-performance-qualification.md)
for raw evidence and limits.
The #202 cleanup is complete through #215. The
owner's planned XML/parser/raw-type replacement is separate; avoid broadening
these tasks into a replacement type system.

For validation commands, see [CONTRIBUTING](../CONTRIBUTING.md). The
[implementation requirements](v2-implementation.md) and
[editor blueprint](v2-editor-blueprint.md) provide the wider migration context.

## Accepted social and character presentation

Character/Appearance (#238/#239) and Farmhands/Relationships (#240) are merged
and owner-accepted. The compact farmer roster keeps native dragging, keyboard
moves and full-body previews; relationship records keep explicit membership
actions and farmer-owned gestures. Recipes (#244) and Storage (#245) are also merged and owner-accepted. Farm
settings (#246), entrypoint/original backups and document-canvas wallpaper (#249),
history shortcuts (#250), and Inventory stability (#251) are merged and owner-accepted.
The [Inventory validation](v2-inventory-layout-validation.md) records measured
selection/scroll behavior and its narrow-layout scope.

The owner accepted the final foundation pass, including Events, and explicitly
confirmed VoiceOver, the native section menu and macOS rubber-band scrolling.
#218 and #219 are closed; those checks are no longer qualification gaps. The [final foundation checkpoint](v2-foundation-validation.md) records the current
page dispositions, native keyboard evidence, export failure fix and the automated scope. #218 records visual acceptance, #219
records interaction/failure qualification, #201 records performance qualification,
and #220 owns the remaining default-route cutover decision.

## Final contribution reconciliation

The [PR reconciliation](v2-pr-reconciliation.md) carries loved gifts/search, archive
deduplication, custom bundle requirements/whole-room actions, thank-you mail,
building descriptions/costs, pregnancy controls and copyable save paths into the
baseline. The owner accepted compact informational presentation and a spouse-row
Family planning disclosure. Export retains lightweight guidance; path copying
leaves file selection explicit. Legacy PR closure follows the validated replacement
merge and preserves contributor attribution. Default-route cutover remains #220.
