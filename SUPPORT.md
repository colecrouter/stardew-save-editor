# Support

- 🐞 Found a bug? [Open an issue](https://github.com/colecrouter/stardew-save-editor/issues/new/choose)
- 💡 Have a suggestion? [Create a feature request](https://github.com/colecrouter/stardew-save-editor/issues/new/choose)
- 🤝 Want to contribute? See [CONTRIBUTING.md](./CONTRIBUTING.md)

## Attaching Your Save in GitHub

If you need to upload your save file to an issue in GitHub, do the following:

1. Find your save file in File Explorer/Finder/Files app/etc.
2. Compress the save file.
   - <img width="596" height="340" alt="image" src="https://github.com/user-attachments/assets/b8211922-a7c6-4f2c-ae51-6677b3c4aa10" />
   - Windows: Right-click -> `Compress to...` -> `ZIP file`
   - macOS: Ctrl-click -> `Compress`
   - Android: Select file -> Press `...` -> `Compress`
   - *(Alternative)* If you can't compress it, rename it to add ".txt" (e.g. `Player_123456` -> `Player_123456.txt`)
3. Upload the file into the textbox in [GitHub issues](https://github.com/colecrouter/stardew-save-editor/issues).

> Thanks for your cooperation. Without your save file, it can be difficult/impossible to debug certain issues.

## Platform Compatibility

The save editor is designed to work with the desktop (PC/macOS) version of Stardew Valley. However, it may be possible to use the editor with other versions of the game (assuming they are updated to the latest major version). The following steps outline how to use the editor with the console versions.

### Android

> TODO: add detailed instructions/links

### Nintendo Switch

Follow the steps outlined in this page from the [Stardew Valley Wiki on transferring your save from NSW](https://stardewvalleywiki.com/Saves#Nintendo_Switch).

No extra steps are required.

### PlayStation 4

> Credit to [SirTribby](https://github.com/colecrouter/stardew-save-editor/issues/39#issuecomment-2504688373) for his help & write-up.

1. Copy your save file to a USB drive.
2. Plug the USB drive into your computer.
3. Use [Save Wizard](https://www.savewizard.net/) to decrypt your save file. [^1]
4. Open the save in "advanced mode" and export the file.
5. **Important:** Open the exported file in any text editor (e.g. Notepad), remove the "compressed" tag at the end of the file, and save it. (see below)
6. Upload the save file to the editor.
7. Make your desired changes.
8. Download the modified save file.
9. Open the modified file in your text editor and copy the contents (Ctrl+A, Ctrl+C).
10. In Save Wizard "advanced mode", delete the contents and paste the modified save file contents.
11. Save in Save Wizard(?)

```diff
- </SaveGame><compressed>
+ </SaveGame>
```

[^1]: Save Wizard is a third-party tool. Use at your own risk.
