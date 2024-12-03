# Support

- 🐞 Found a bug? [Open an issue](https://github.com/colecrouter/stardew-save-editor/issues/new/choose)
- 💡 Have a suggestion? [Create a feature request](https://github.com/colecrouter/stardew-save-editor/issues/new/choose)
- 🤝 Want to contribute? See [CONTRIBUTING.md](./CONTRIBUTING.md)

## Console Support

The save editor is designed to work with the PC version of Stardew Valley. However, it may be possible to use the editor with the console versions of the game. The following steps outline how to use the editor with the console versions.

### Nintendo Switch (Untested)

Follow the steps outlined in this page from the [Stardew Valley Wiki on transferring your save from NSW](https://stardewvalleywiki.com/Saves#Nintendo_Switch).

### PlayStation 4

> Credit to [SirTribby](https://github.com/colecrouter/stardew-save-editor/issues/39#issuecomment-2504688373) for his help & write-up.

1. Copy your save file to a USB drive.
2. Plug the USB drive into your computer.
3. Use [Save Wizard](https://www.savewizard.net/) to decrypt your save file. [^1]
4. Open the save in "advanced mode" and export the file.
5. **Important:** Open the exported file in any text editor (e.g. Notepad), remove the "compressed" tag at the end of the file, and save it.
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
