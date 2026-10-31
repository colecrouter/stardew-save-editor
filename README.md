# Stardew Valley Save Editor

A browser-based editor for Stardew Valley saves. [Open the hosted editor](https://colecrouter.github.io/stardew-save-editor/).

## V2 status

This branch contains the v2 editor at `/v2` in the development server. The default-editor
cutover is still pending; the hosted site may differ from this branch. V2 and the
legacy editor open separate editing sessions.

Core v1 UI porting is complete. Visual/device validation, documentation and
cutover belong to the **V2 editor foundation** milestone. Additional features in
**V2 release** are stretch goals, not prerequisites for that baseline.

## Features in v2

- Character details, money, skills, professions, mastery and appearance preview.
- Relationships, events, cooking/crafting recipes, quest journals and Qi orders.
- Inventory/equipment editing, item selection, actual backpack sizes and transfers.
- Storage search, multiple-item transfers, bulk quality, Organize and supported
  chest conversions. Organize keeps stacks separate.
- Farm settings, date/weather editing, buildings, animal editing and adoption.
- Community Center/remixed bundles, Joja projects and explicit theater progression.
- Farmhand reassignment, change review, grouped Undo/Redo, import/export and original
  save backups.

Pet/child editing, general location editing, lost-progress restoration, non-Qi
special-order editing and the planned parser replacement remain separate work.
See [current engineering status](docs/v2-status.md) for scope and validation evidence.

## Using the editor

Keep a separate copy of the entire save folder before editing. Choose the main
farm save, make your edits, review the changes, then export and replace that file
with the game closed. A download does not automatically update the game's save.

The [save guide](SUPPORT.md) explains file selection, desktop/iOS/Android locations,
review and Undo, downloading/replacement, browser backup limits and troubleshooting.

## Compatibility

V2 accepts saves tagged **Stardew Valley 1.6.x**; older versions are rejected.
Recognized saved fields can be edited, while unfamiliar or ambiguous data may be
read-only. Modded-save support is not guaranteed.

Current Chromium workflows have automated coverage on desktop and phone-sized
viewports. Actual Safari/iOS/Android file replacement and assistive-technology
qualification remain open in [#219](https://github.com/colecrouter/stardew-save-editor/issues/219).
A responsive layout is not device certification. Console save extraction and
repacking are outside this editor's supported workflow.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, tooling and validation.

## Legal

This project uses Stardew Valley assets owned by ConcernedApe under Fair Use;
those assets are not covered by this project's license. See [LICENSE.md](LICENSE.md).
