# V2 implementation requirements

The [editor blueprint](v2-editor-blueprint.md) now moves into an isolated working
slice before production migration. The existing save editor remains usable while
we establish the shared contracts.

## Tooling foundation

- Use Oxfmt as the single formatting entry point, including Svelte. Keep lint
  coverage explicit: formatting does not replace lint diagnostics.
- Use TypeScript 7 for ordinary TypeScript checks and Effect's native language
  service for Effect diagnostics. Retain a compatible JavaScript TypeScript SDK
  wherever Svelte tooling requires its compiler API.
- Install language-service support reproducibly and run diagnostics in CI. Report
  the complete diagnostic stream when changing Effect code; assess suggestions in
  context rather than blindly rewriting boundary code.
- Align CI and local setup on Node 24. Keep codegen's transpilation support until
  its syntax and import graph have been verified under native Node execution.

This follows the useful tooling separation in
[seed-hawk-cloud](https://github.com/Vaderstad-AB/seed-hawk-cloud), particularly
its native TypeScript alias, Svelte compiler SDK, and separate Effect diagnostics.
Its application infrastructure and organizational workflows are not requirements
for this repository.

## Shared components: visual and functional requirements

A one-to-one port of the current UI is not a V2 goal. Existing layouts and colors
may be retained temporarily for regression validation; they do not constrain the
redesign. Explore a more faithful in-game visual language and a distinct,
restrained editor identity with pixel-art accents. Select a coherent direction
and validate it on real editing workflows.

Responsiveness includes pixel art: preserve crisp integer-scale sprites while
layouts reflow, navigation adapts, and text and controls remain usable on narrow
screens. Scaling down a desktop screenshot or clipping a fixed-width game panel
does not satisfy this requirement.

V2 includes consolidation of the existing reusable and bespoke controls, beyond
the current field/session experiment. Audit buttons, text/number inputs, selects,
dropdowns, comboboxes, dialogs and their variants across representative screens.

- Establish a coherent shared component set for ordinary controls. Native HTML
  is a useful implementation inside those components; it does not require each
  feature to repeat markup, styling and accessibility wiring.
- Define consistent typography, spacing, sizing, colors and interaction states,
  including hover, focus, disabled, invalid and pending states. Check long labels,
  narrow screens and touch targets in the rendered UI.
- Verify accessible names, descriptions/errors, keyboard navigation, form submit
  and cancellation, focus visibility/restoration, and the behavior of searchable
  and empty selectors. Use library primitives where they reduce interaction work.
- Keep presentation components usable for search/filter forms and dialogs without
  requiring a save session. Editor field adapters connect them to drafts,
  validation, mutations and history.
- Migrate a representative production screen onto the shared components and
  remove its superseded variants. Record remaining usages and intentional
  domain-specific exceptions so consolidation can proceed incrementally.

Acceptance requires both visual review and interaction checks. A library choice,
token stylesheet, or component wrapper alone does not satisfy this work. The
native/Bits confirmation experiment informs one interaction; it does not settle
the choice of a broader component system.

## First working UI slice

1. Give stack editing an explicit draft: typing creates no mutation or history.
   Invalid input stays visible; a successful submit creates one action.
2. Preserve a dirty draft when its source changes. Explain the conflict and let
   the user reload the current value. Changing target must never silently apply
   a draft to another item.
3. Share field labeling, descriptions, errors, and native constraints without
   hiding domain operations inside a generic form generator.
4. Compare native controls with Bits UI for a compound dialog, including keyboard
   navigation, focus return, cancellation, and session teardown.
5. Prove the contract against a Stardew calendar and a compound completion action
   before moving it into the production app.

Acceptance includes preservation of unknown save data, atomic undo/redo, no leaked
subscriptions or session resources, and keyboard-operable controls. Library and
bundle costs are evidence for the decision, rather than automatic disqualifiers.

## Migration gate

Production inventory migration requires stable item identity across moves and
undo/redo, plus explicit handling of dirty drafts during external changes. The
session now distinguishes duplicate backpack items for stack/reorder operations.
Creation, deletion, merging and transfers still need identity semantics and proof
before claiming the production contract is ready.

## Current evidence

The [control and operation implementation notes](v2-controls-and-operations.md)
cover the production calendar control migration, inventory operations, byte
budgets, lifetime repair, and the calendar domain-state extraction prerequisite.

The stack draft, monotonic revision guard, duplicate-item identities, and native/Bits
confirmation comparison are implemented in the lab. All 54 experiment tests pass.
The complete Effect diagnostic stream is clean. Oxfmt, TS7 checks, Svelte checks,
and clean dependency installation pass; all 561 app tests have passed (one Qi quest timeout in the full run passed with its complete 34-test file on isolated retry). Production build
compilation succeeds, while the configured Sentry upload remains blocked by HTTP
403 permissions. No deployment was attempted.

The first dialog comparison favors native HTML for this simple confirmation. Bits
remains useful to evaluate for item selection/popovers; it is loaded on demand in
the lab. Calendar and bundle adapter extraction, broader item identity operations,
and existing production proxy lifetimes are still required before migration.
