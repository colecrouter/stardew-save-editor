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
prototype's slot and item-ID guard does not distinguish duplicate items. Resolve
that in the session before claiming the production contract is ready.
