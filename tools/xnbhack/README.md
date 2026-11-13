# Asset extraction

Set `STARDEW_GAME_PATH` to a vanilla installation containing `Stardew Valley.dll`,
then run `npm run dump`. The tool calls XnbHack directly and performs all catalog
transformations in C#. There is no Node launcher or second generation process.

This requires the .NET 8 SDK (or a newer SDK plus the .NET 8 runtime) and a graphics
display. Windows needs Developer Mode or permission to create symbolic links for
the temporary Content link. On headless Linux, run the command through
`xvfb-run` with Mesa installed.
The integration calls XnbHack's API directly; it does not launch its CLI, SMAPI,
or installed mods.

The project references game assemblies in place and restores the toolkit from
`Pathoschild.Stardew.ModBuildConfig` without importing its mod build targets.
The toolkit's HTTP dependency is explicit because game startup scans loaded
assemblies, including toolkit types unused by the unpacker. The TMX writer uses
upstream's .NET Framework package; its NU1701 compatibility warning is expected.

XnbHack's progress callback redirects output into a temporary workspace and
detects failures. Unsupported shader assets are copied as XNB; other failures
stop generation. `--clean` is deliberately not used: code generation expects all
JSON fields, including defaults. Complete exports are transformed in the workspace
before `content`, `generated` and `static/assets` are replaced together, with
rollback if publication fails. Existing sibling output such as the typed save
codec under `generated/save-format` is preserved. The temporary `Content` link in
the host's build output is removed afterward; no files are installed into the game.

See [vendor/README.md](vendor/README.md) for the pinned upstream source and license.

The generator is split by domain: `CatalogGenerator` coordinates item catalogs,
`ArtisanCatalog` derives preserved goods, `GiftCatalog` applies gift precedence,
`QuestCatalog` resolves recipes and quest tokens, and `WorldCatalog` handles
buildings, textures and map weather contexts. `npm run test:asset-dump` tests the
production code using language-neutral regression fixtures and filesystem
publication scenarios without a game installation.
