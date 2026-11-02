# Shared Stardew components

`src/lib/ui/kit` is the styled presentation layer for subsequent v2 visual work
(#218). It has no save records, command queue, parser, validation engine or Undo
policy. Existing editor field adapters remain the value/lifecycle boundary;
legacy `UIInput` is not a replacement for those adapters.

## Initial inventory

- `StudyButton`: native button attributes/events, default `type="button"`,
  independent `intent="neutral|constructive|destructive"` and
  `variant="plain|filled"` choices, plus explicit disabled/pending states.
  Plain buttons retain paper with intent-coloured text/borders; filled buttons
  use the intent colour with light text. `iconOnly` reserves a square 44px target
  and requires a caller-provided accessible name. The global Exit X uses the
  filled destructive treatment; Export uses filled constructive. Pending
  sets `aria-busy` and disables activation. Do not disable history controls during
  field blur commits: that would swallow the click which must queue after editing.
- `StudyField`: vertical label, description and error associations around a
  caller-provided native control. Its child snippet receives `id`,
  `aria-describedby` and `aria-invalid`; spread them onto the actual control.
  It neither parses nor resets partial input. Use the `study-input` class for
  native text/number/select/textarea presentation.
- `StudyCheckbox`: a real native checkbox with a bindable checked value,
  native attributes/events and optional description. Domain-facing toggles should
  continue using the existing immediate-field controller's discrete edit policy.
- `StudyPanel`: paper, inset or plain containers; optional title names a section.
  Feature code owns layout. Use existing `StudyFrame`, `EditorShell` and
  `ParchmentPane` for outer framing rather than stacking decorative frames.
- `StudyAside`: supplemental inline context in reading order.
- `StudyAlert`: an icon, explicit title and semantic info/success/warning/danger
  surface. Static notices are not live regions. Choose `live="polite"` or
  `live="assertive"` only for dynamic feedback that needs announcement.
- `StudyTabs`: a named, controlled tab set. Arrow/Home/End move focus; Enter/Space
  activate a tab. All panels remain mounted, and inactive panels are hidden from
  keyboard navigation and accessibility. Values must be unique; the owner supplies
  an initial value present in the items. Removing an item requires the owner to
  reconcile the selected value.
- `StudyDialog`: a named modal with controlled/bindable open state, description,
  optional body and footer snippets. Bits UI owns focus containment/restoration.
  `dismissible=false` blocks Escape, outside interaction, X and the footer's
  supplied close callback. Owners should also disable their footer Cancel/action
  buttons while pending so the visual affordance matches that policy. Owners may
  still close the controlled dialog after successful completion.
- `StudyTooltip`: supplemental text on its actual action button, with keyboard
  focus/Escape and pointer behavior. It forwards Bits trigger props. Never put a
  second button inside its children. Do not hide essential instructions or errors
  in hover-only help; native mobile use does not depend on a tooltip opening.
- `StudyPopover`: explicitly opened, named **nonmodal** rich help, with a close
  control, Escape and trigger-focus restoration. It does not trap focus.

## Shared appearance

`kit/tokens.css` names ink, paper, inset, rules, wood, action, severity and focus
colours. Defaults are scoped to `.study-kit`/`.study-theme`, not the document root.
`kit/styles.css` imports the existing fonts/theme and button styles. Components
import it themselves; portaled content repeats the kit scope so typography and
colours survive leaving the originating DOM tree. There is no new default app
background, route or global native-input reset.

Text and icons both identify severity. Inputs retain native semantics and Undo.
State changes preserve control borders/geometry. Existing editor screens can adopt
these primitives during their visual pass; this slice does not migrate every
consumer or retire legacy components.

## Bits UI selection

The [Bits UI component inventory](https://www.bits-ui.com/docs/components/dialog)
was reviewed. Use its [Dialog](https://www.bits-ui.com/docs/components/dialog),
[Tabs](https://www.bits-ui.com/docs/components/tabs),
[Tooltip](https://www.bits-ui.com/docs/components/tooltip) and
[Popover](https://www.bits-ui.com/docs/components/popover) interaction primitives.
The pinned version is 2.20.3. Native button/input/select/checkbox/radio controls
remain preferable to adding a second form-value implementation.

Accordion/collapsible content can use native details when appropriate. Menus,
comboboxes, switches, sliders, drawers/sheets and custom scroll areas are deferred
until a concrete screen needs them. Stardew's game calendar remains the domain
calendar; a generic Gregorian date picker is not appropriate. Destructive actions
need an intentional confirmation policy from their feature owner rather than an
automatic dialog around every button.

## Validation and previews

`tests/ui/kit.svelte.test.ts` exercises native button/form behavior, unavailable
activation, feedback IDs, retained panel DOM and opt-in alert announcements.
Browser checks additionally cover real focus loops/return, manual tab activation,
tooltip descriptions/Escape, popover behavior and pending-dialog dismissal.

The review preview is a temporary standalone Svelte/Vite harness outside the
repository, rendering the actual components. No gallery, showcase route or
example save is shipped. Screenshots contain illustrative component copy; they do
not represent an actual export or a new editor transaction workflow. Laboratory
Chromium checks do not certify every Safari/device/assistive-technology combination;
#219 retains the concrete release validation checks.
