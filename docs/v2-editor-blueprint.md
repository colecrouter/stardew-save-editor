# Editor framework blueprint

## Proposal and status

Build a small internal editor toolkit that connects source adapters, domain operations,
transactional sessions, feature view models, and reusable interaction components.
Evaluate native HTML plus Bits UI as the interaction foundation. This is a blueprint
and library shortlist, not a selected production framework or a completed #170 prototype.

Design the contracts together, then implement them through a few complete editing
flows. A useful abstraction should remove repeated behavior while keeping game rules
visible and testable. The existing inventory lab proves parts of the session/view
boundary; it does not yet prove all contracts proposed here.

## The formats we actually have

There are two source pipelines:

1. Player save bytes: XML, sometimes compressed, with platform packaging and version
   conventions. XMLCodec currently produces the parsed object used for export.
2. Game content: unpacked data/assets transformed by codegen into catalogs, recipes,
   descriptions, dimensions and sprites. Those describe possible game entities rather
   than the state of one player's save.

Treat the parsed save as a preservation document. It includes unknown fields,
serializer wrappers, duplicate representations and modded content. It is not already
a clean domain model. Retain the imported bytes and source identity separately.

Expose domain projections and targeted operations over that document instead of
reconstructing an entire save from a universal canonical schema. For example, expose
an item's stack, quality and supported capabilities while retaining its other fields
in the preservation document. A future normalized model could be justified in a
particular domain; complete reconstruction must first prove unknown-data preservation.

## Responsibilities and ownership

### Source adapters and catalogs

Save-format adapters own XML names, nil markers, array conventions, game-version
differences and mirrored save fields. Platform adapters own file access, compression
and export packaging. Pure codecs remain reusable behind workers and Node tests.

Catalog providers own game IDs, available types, localized game text, sprite metadata,
and content loading. Lookup should tolerate missing/modded entries. Existing proxy
constructors remain eligible implementations if they can satisfy lifetime and
preservation requirements; the interface does not prescribe how a lookup is computed.

An export envelope records filename, format/version, compression/packaging information,
and the preserved document. Export policy may intentionally change packaging, but that
choice must be explicit and verified for the target platform.

### Domain adapters, references and operations

Domain adapters translate between preservation data and concepts such as Farmer,
InventorySlot, Item, Bundle and FarmDate. They expose capabilities and limitations:
can this item stack, which qualities exist, can this backpack shrink, what is shared
between players? A UI can render an unsupported value without silently replacing it.

Operations own coordinated changes and validation. SetItemStack and CompleteBundle
are explicit intents whose implementation may update several source fields. Their
results include actual changes, affected entities, review metadata and diagnostics.
UI field bindings can remain convenient setters that dispatch these operations.

Resolve targets using domain references. Persistent game IDs can be used where they
exist. Items without unique IDs need session-local identity, held outside exported
XML. Reordering, replacement, undo and redo must update identity/location metadata
atomically with the document. The prototype's slot plus expected item ID is insufficient
for distinguishing duplicate items after movement; this identity work is a prerequisite
for a production inventory migration, not an already solved detail.

### Session and history

The Effect session owns the authoritative document, entity resolution, transaction
history, validation services, worker/file resources and export. Operation preparation
receives isolated drafts. Successful document, identity, domain-state and history
changes commit together; failed preparation leaves all of them unchanged. Domain
state holds operation-owned information such as remembered weather and watering
provenance; it is separate from the exported save representation.

History stores intent and reversible changes. Review policy can emphasize, group or
compact an entry while keeping its changes inspectable. Net review compares the
current export representation with the imported baseline, including changes outside
the operation log. Repairs and format normalization need recognizable provenance.

Session scopes own long-lived resources. Views/searches/jobs can own shorter scopes;
keeping everything until session close would still allow growth during a long session.
Whether resources use proxies, caches or plain projections is an implementation choice.

### Feature models and fields

Feature models expose domain read models, capabilities and commands through Atom.
Selection, search and presentation state can be ephemeral. Editing state is committed
through the session. Undo/redo and export are session commands, not local component
state restoration. A store adapter remains an alternative for simple views.

A reusable field model connects these layers. It describes the value, parse/format
behavior, constraints, diagnostics, disabled reasons and commit operation. A field's
draft belongs to its editing interaction, so two panels need not share half-typed text.

Illustrative contracts, not production API signatures:

```ts
interface Field<T> {
	value: ReadModel<T>;
	label: Message;
	description?: Message;
	availability: ReadModel<Capability>;
	constraints: ReadModel<Constraints<T>>;
	parse(text: string): ParseResult<T>;
	format(value: T, locale: Locale): string;
	commit(value: T): Operation<void>;
}

interface Feature {
	id: FeatureId;
	title: Message;
	load(): Promise<FeatureModule>;
}
```

ReadModel can be backed by Atom; Operation can be backed by Effect. Those choices do
not make serialized field paths part of the component API. Constraints may be shared
with UI affordances, but domain operations validate independently of component presence.

Draft behavior needs an explicit contract: preserve intermediate input such as an empty
number or a minus sign; parse on the chosen boundary; show errors beside the field;
commit one intentional action; show the committed value after undo. If another operation
changes the underlying value while a draft is dirty, show a conflict/rebase choice rather
than silently overwriting either value. Cross-field editing uses a draft form that commits
one compound operation. Validation errors should include a field target when possible.

### UI interaction system

The internal component set provides consistent Field layout, NumberField, TextField,
ChoiceField, ActionButton, dialog/menu/tooltip wrappers, error summaries, sections and
responsive layouts. Field labels/descriptions/errors get consistent IDs and associations;
dialogs have a predictable focus/close policy. Visual tokens cover spacing, typography,
focus, touch targets and surfaces. Styles can remain scoped to the components that own
them; reducing inline CSS is not itself the success criterion.

Domain widgets remain specialized where their interactions are specialized: item grids,
appearance previews, bundle requirements, farm calendars and location canvases. Reuse
their field/action/selection contracts and interaction primitives instead of generating
every screen from raw save schemas or creating a new control for each field.

## What a UI library buys

Native HTML already supplies useful behavior for buttons, text/number inputs, ordinary
selects and disclosures. Keep it where it fits; consistent styling and field composition
can be internal. A headless library brings the most value for compound interaction:
dialog focus and restoration, menus, combobox navigation, popovers, tooltips, portals,
and related keyboard/pointer behavior. It reduces behavior we implement and repair.

It does not supply save semantics, operation history, draft conflicts, asset loading,
localization strategy or game-specific validation. Those responsibilities remain in the
editor toolkit. Accessibility still needs integration tests and clear labels/content.

### Shortlist

- **Native HTML plus Bits UI: leading prototype candidate.** Bits supplies headless
  Svelte primitives while leaving styling free of a required theme/CSS framework. Its
  Dialog documents focus trapping, open/close focus, Escape and outside interaction.
  This fits retaining a Stardew-inspired presentation while outsourcing complex behavior.
- **shadcn-svelte: strong styled-starting-point candidate.** It distributes editable
  component code built with Bits UI and Tailwind. Field/layout patterns may save work,
  but copied top-level styling/composition becomes code we maintain. This is attractive
  if we want those conventions; it is not necessary to use Bits or the editor toolkit.
- **Skeleton: broader design-system candidate.** Its tokens, themes, Tailwind utilities
  and components could reduce visual design work. It asks for broader adoption of its
  conventions, which should be evaluated against the intended light redesign.
- **Melt UI: lower-level builder alternative.** More control over element composition
  may be useful for gaps, but it offers less abstraction over the behavior we currently
  keep reviewing. That makes it a secondary candidate for this particular goal.

Registry metadata checked during this investigation: Bits UI 2.20.2 supports Svelte
^5.33.0; Skeleton's Svelte package 5.0.1 supports ^5.40.0. Both fit the installed 5.55.7
by declared peer range. Peer compatibility is not runtime validation. No candidate is
installed or adopted by this blueprint.

## Three flows the toolkit must explain

### Edit an item's stack

The source adapter resolves an ItemRef and preserves its opaque fields. Domain/catalog
capabilities determine whether stacking is supported and its actual limit. The feature
model exposes a stack field. NumberField manages draft parsing and labels; commit sends
SetItemStack to the session. The adapter writes its draft document, history records the
operation, and Atom updates the affected views. Undo and export use the same session.

The UI never needs to interpret xsi:type or decide a stack limit from an XML property.
Unknown items can still be shown with a reason when editing support is incomplete.

### Change farm date/weather

FarmDate is year/season/day with four 28-day seasons. A generic Gregorian date-picker
does not represent that domain. Use a specialized calendar composed from accessible
buttons/grid navigation and shared fields. Domain operations determine coordinated
date/weather writes, festivals, timers and watering behavior; library calendar defaults
must not define Stardew's rules. Changes to the calendar do not simulate every elapsed
night. Preview dependent changes when needed, then commit one operation/group.

### Complete a bundle

The UI composes a requirement list and a completion action. Domain code evaluates the
bundle, room effects, rewards and linked flags. The session records a grouped outcome.
A reusable confirmation or result dialog supplies focus/keyboard behavior. A boolean
field auto-generated from XML would miss the domain operation and its consequences.

## Lazy content and localization

Feature manifests contain small metadata and dynamic module loaders. Route entry code
does not eagerly import every feature's catalogs. Catalog services load slices on demand
and cache them according to measured reuse/lifetime. Code-splitting needs bundle/network
verification: moving a dynamic import behind another eager barrel is not sufficient.

App messages and game-derived localized text are separate resources. Stable IDs and
typed message keys cross layers; labels never become entity identity. History records
semantic intent/arguments so it can be formatted in the active locale later. Include
fallbacks for unknown mod names and missing translations. Image/sprite loading needs its
own fetch/decode/cache strategy; dynamic imports only address part of asset delivery.

## Validation and implementation sequence

1. Prove a draft field plus mutation-backed commit on the current inventory lab. Include
   invalid intermediate text, undo during editing, external edits and domain constraints.
2. Compare native dialog/controls with Bits equivalents on item selection and a compound
   edit confirmation. Measure code owned, focus/keyboard/touch behavior and styling cost.
   Compare a shadcn-based starting point if the design conventions look useful.
3. Exercise the same field/action contracts with calendar and bundle operations. Adapt
   the contracts where actual domain differences demand it; avoid generalizing from stack
   editing alone. Date-specific and bundle-specific requirements remain in their tasks.
4. Prove preservation/identity/undo with supported, unknown and modded entities, then
   migrate one full production workflow. Check that loading/viewing does not cause
   undocumented writes and that exported changes match recorded intent/provenance.
5. Verify route/catalog/locale loading boundaries and shared resource lifetimes before
   broadly migrating feature modules. Use the results to update #171's architecture decision.

Outcome checks include accessible names/focus restoration, no unrelated save changes,
failure atomicity, stable targeting after moves, accurate net review, bounded resource
retention, keyboard/touch usability, and startup/interaction measurements on representative
mobile data. A count of wrappers or a particular library is not an acceptance criterion.

## Open design choices

The [implementation requirements](v2-implementation.md) now have a working stack
draft and native/Bits confirmation comparison in the inventory lab. Session-only
item identities are atomic with reorders and undo/redo, including swaps of
byte-identical items. Draft commits check a monotonic document revision. This
establishes those contracts for stack/reorder operations; identity semantics for
creation, deletion, merging and transfers still need proof before migration.

The simple confirmation works well with native `<dialog>`. Bits UI remains a
candidate for compound selection/popover behavior, rather than a prerequisite
for ordinary controls. Its experiment component is dynamically imported when
selected. The calendar prototype now proves atomic date/weather preparation and cloned
watering provenance with shared production rules. Calendar lab controls and bundle
operations remain contract tests; general farm identity maintenance is still open.

Resolve broader entity identity operations, adapter versioning, field-granular draft conflicts,
history byte budgets/persistence, selective revert, translation keys for existing game
text, worker lifetime/pooling and scope ownership for existing convenient factories.
These choices should be explicit before a general feature registration API is fixed.

The current experiment still copies and compares large documents. The blueprint does
not assume Atom, a UI framework, or Schema automatically removes that cost.

## Sources

- [Bits UI](https://www.bits-ui.com/docs)
- [Bits Dialog](https://www.bits-ui.com/docs/components/dialog)
- [Bits Tooltip](https://www.bits-ui.com/docs/components/tooltip)
- [shadcn-svelte approach](https://www.shadcn-svelte.com/docs)
- [shadcn Field](https://www.shadcn-svelte.com/docs/components/field)
- [Skeleton fundamentals](https://www.skeleton.dev/docs/svelte/get-started/fundamentals)
- [Melt builders](https://melt-ui.com/docs/introduction)
- [Local architecture audit](v2-discovery.md)
- [Atom comparison](v2-atom-comparison.md)

Candidate value is a source-backed architectural assessment, not a completed benchmark
or accessibility audit of those libraries in this editor.
