# Save guide

This guide describes the v2 editor on the `v2` branch. Its default-editor cutover
is pending; the hosted site may still show the legacy editor. Review and Undo
instructions below refer to v2.

## Choose the right file

Use a save tagged Stardew Valley **1.6.x**. Open the main file inside the farm's
save folder, typically with a name like `Farmer_123456789`. Keep its exact name,
including an existing `.bin` suffix on devices that use one.

- `SaveGameInfo` is the game-menu summary, not the main save. Keep it in the game
  folder, but do not select it in the editor; the editor does not regenerate it.
- A file ending in `_old` is an older game backup. Normally edit the current main
  file; choosing an older copy means starting from its older progress.
- A ZIP is a folder backup, not an editor input. Extract it and select the main file.

The [Stardew Valley Wiki's save guide](https://stardewvalleywiki.com/Saves#Save_format)
explains the game folder and companion files. In multiplayer, use the host's save;
selecting a farmer in the editor does not create a separate farmhand save file.

## Find your save

| Platform    | Usual location                                                              |
| ----------- | --------------------------------------------------------------------------- |
| Windows     | `%AppData%\StardewValley\Saves`                                             |
| macOS       | `~/.config/StardewValley/Saves` (Finder → Go → Go to Folder)                |
| Linux       | `~/.config/StardewValley/Saves`                                             |
| iPhone/iPad | Files → Browse → On My iPhone/iPad → Stardew Valley                         |
| Android     | Internal storage → `Android/data/com.chucklefish.stardewvalley/files/Saves` |

Open the folder for your farmer. Linux installations using a custom configuration
location or a sandboxed launcher can differ. These are documented game locations,
not a promise that a browser can access them; see the
[game's platform instructions](https://stardewvalleywiki.com/Saves#Find_your_save_files).

## Editing and replacing a save

1. Save your game progress and close Stardew Valley. Copy the **whole save folder**
   somewhere separate before changing anything; retain the original companion files.
2. In v2, choose **Save file** and select the current main save. Check the displayed
   date, farmer and farm information before editing. Imported problems are listed
   separately; viewing a save does not repair them automatically.
3. Make your changes. Ordinary fields update the editing session immediately;
   leaving a text/number field groups its typing into one Undo action. Date changes
   use **Apply date** because they can have coordinated consequences. Changing a
   date does not simulate playing intervening days.
4. Open **Review changes**. History describes actions; net changes compare the
   current save with the imported file. Undo/Redo affects the open session. A new
   edit after Undo discards the redo branch. History is bounded, so older actions
   may stop being undoable even though they remain part of the net changes.
5. Choose **Export save**. Some browsers offer a save-location picker; others
   download a file. Wait for completion. The editor requests the original filename;
   your browser may append a duplicate suffix such as `(1)`.
6. With the game closed, copy the downloaded file into the original farm folder,
   replacing only the main file. Its name must match the original exactly. Leave
   `SaveGameInfo` and other companion files in place. Keep your separate original.
7. Load that farm and check the date, farmer and intended edits in-game. If it
   fails to load or looks wrong, close the game and restore your original folder
   before making further edits. If changes disappear, check whether cloud sync
   restored a different copy.

Export writes XML, even when the imported save was compressed; it does not preserve
compression or byte-for-byte formatting. A successful import can archive the exact
original bytes, including compressed data. Changing a filename alone does not
convert a console save or change its format.

## iPhone and iPad

Use Files to copy the original folder to a separate backup location. In the editor's
file chooser, browse to the main file in the Stardew Valley folder.

After export, open Safari's Downloads list or locate the download in Files. Downloads
may be in iCloud Drive rather than On My iPhone/iPad; see
[Apple's download instructions](https://support.apple.com/en-us/102440).
Copy the completed file back into the original farm folder, confirm replacement,
and check its exact filename before opening the game. Keep the companion files.

If Files does not expose the folder, use the
[game's computer-transfer instructions](https://stardewvalleywiki.com/Saves#iOS)
rather than assuming the browser can grant access. These steps describe the intended
workflow; representative iOS/Safari replacement testing remains pending.

## Android

First confirm you can both copy a save out **and** replace it in its original
folder. If your device permits it, copy the main file to Downloads, edit that copy,
then copy the completed export back with its original name.

Modern Android file pickers restrict access to `Android/data`; installing a file
manager or granting ordinary media permissions does not guarantee access. See
[Android's storage access restrictions](https://developer.android.com/about/versions/11/privacy/storage#document-access-restrictions).
The editor cannot bypass them. If access is denied, consult the
[game's transfer guidance](https://stardewvalleywiki.com/Saves#Android) and use a
computer-assisted transfer where your device permits it. Do not assume every
Android device supports same-device editing and replacement.

Locate the export in your browser's downloads or file manager, remove only a
browser-added duplicate suffix, and preserve the original extension. Device storage
restrictions and actual Android replacement still need representative testing.

## Original backups and Undo

**Original save backups** on the opening screen lists up to five successfully
archived imports in this browser/site's storage. New imports evict the oldest
entries. These are originals, not snapshots of your editing progress.

- **Open original** starts a new editing session from that file; it does not restore
  anything into the game or create another archive entry.
- **Download original** retrieves the stored original bytes and filename.
- **Delete backup** requires confirmation and removes only that archive entry.

Backups are not cloud sync. Legacy and v2 share backups on the same site origin. Another browser/profile or site origin will have different
storage; private browsing, clearing site data or browser eviction can remove them.
If archiving fails, editing remains available with a warning. Keep a separate folder
backup regardless. Undo history is session-only and does not survive Exit, reload
or opening another file. To retain edits, export before leaving.

## Compatibility and troubleshooting

The configured browser baseline includes Safari/iOS 15.4+, Chrome/Edge 100+ and
Firefox 100+. These are build targets, not a claim that every device/file flow has
been tested. Chromium desktop and phone-sized automated checks have passed;
real-device, native-menu and assistive-technology qualification remains tracked in
[#219](https://github.com/colecrouter/stardew-save-editor/issues/219).

- **Wrong file or unreadable data:** select the main 1.6.x save, not SaveGameInfo, a
  ZIP, or an incomplete download. Retry with your untouched original.
- **Read-only controls:** some imported records, modded items or ambiguous data
  cannot be edited safely. Disabled controls can explain the restriction; an
  unknown value is not permission to replace it with a default.
- **Export blocked:** finish or reload a pending date selection, and inspect any
  validation errors. An invalid field can need correction before the intended edit
  is accepted. Canceling a browser save picker does not apply changes to the game.
- **Download/write failed:** the editing session remains open for retry. Check the
  destination and browser permissions; do not Exit before retaining a completed export.
- **Modded or console saves:** broad compatibility is not certified. The editor
  does not install mods, extract console saves or repack proprietary containers.

For an editor problem, [open a GitHub issue](https://github.com/colecrouter/stardew-save-editor/issues)
with the editor version/branch, game version, browser/device, steps, expected result
and visible error. Share a save only if you are comfortable making its contents
public. For game save recovery or platform transfer questions, start with the
[game's save troubleshooting](https://stardewvalleywiki.com/Saves#Troubleshooting).

## Sharing a save with a bug report

Attach a ZIP containing a copy of the relevant save to the
[GitHub issue](https://github.com/colecrouter/stardew-save-editor/issues/new/choose).
If you cannot make a ZIP, adding `.txt` to a **copy** can make it attachable. That
suffix is for the issue attachment only; retain the original game's filename.
Screenshots and reproduction steps help identify the problem before anyone needs
the full save. Issue attachments are public.

For feature suggestions, use the same issue form. To contribute code or improve
this guide, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Historical console reports

Earlier documentation included a community PS4 extraction/repacking workflow
credited to [SirTribby](https://github.com/colecrouter/stardew-save-editor/issues/39#issuecomment-2504688373)
and linked the [Wiki's Switch transfer instructions](https://stardewvalleywiki.com/Saves#Nintendo_Switch).
Those are historical reports, not verified v2 console support. The original
write-up remains available in the
[previous support guide](https://github.com/colecrouter/stardew-save-editor/blob/1641bd3/SUPPORT.md#playstation-4).
