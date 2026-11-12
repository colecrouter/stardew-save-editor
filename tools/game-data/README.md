# Game data tools

A .NET 10 console tool for exploring the game's XML serialization metadata,
comparing it with saves, and exporting unpacked assets. It operates independently
of the web application and never requires game files for normal app builds.

## Getting started

Install the .NET 10 SDK, then run from the repository root:

```bash
dotnet build tools/game-data/extractor
dotnet run --project tools/game-data/extractor -- --help
dotnet run --project tools/game-data/extractor -- inspect --help
```

Arguments after `--` belong to the extractor. Every command supports `--verbose`
for detailed errors. `--version` prints the CLI version. JSON goes to stdout when
no output file is specified; progress and external unpacker logs go to stderr.
Exit codes are `0` for success, `1` for operational failure or comparison issues,
and `2` for command-line parsing errors. An incomplete inspection still writes its
catalog and returns `1`; inspect `diagnostics` before using it.

## Local game inputs

`inspect` and `unpack` resolve the game directory in this order:

1. `--game-path <directory-or-file>` (alias `-p`).
2. `STARDEW_GAME_PATH`.
3. Common Steam installation paths, extra libraries in `libraryfolders.vdf`, and
   `~/GOG Games/Stardew Valley`. macOS app bundles are checked under `Contents/MacOS`.

An explicit invalid path fails instead of silently selecting another version.
The directory must contain `Stardew Valley.dll` and its managed dependencies.
Legacy installations without this assembly layout aren't supported yet. Keep the
full vanilla game directory together; an isolated copy of the main DLL isn't enough.

Prefer versioned input snapshots outside the repository:

```text
~/.local/share/stardew-save-editor/game-data/<game-version>/
  game/         # vanilla installation snapshot
  unpacked/     # exported JSON, PNG, TMX and manifest
  catalog.json  # assembly metadata catalog
```

The tool does not move, update, or download games. Point `STARDEW_GAME_PATH` at
`game/`. Input/output paths remain explicit; there is no implicit latest-version
selection. The existing repository `content/` still serves the current Node
codegen scripts; this tool doesn't change those imports or assume the contents
match a particular game version. Don't commit game binaries or unpacked inputs.

## Inspect

```bash
dotnet run --project tools/game-data/extractor -- inspect \
  --game-path "/path/to/Stardew Valley" \
  --output /tmp/catalog.json

# Narrower experiments; --type can be repeated or accept multiple values.
dotnet run --project tools/game-data/extractor -- inspect \
  --type StardewValley.Farmer --type StardewValley.Item \
  --output /tmp/player-catalog.json
```

The default root is `StardewValley.SaveGame`. Traversal follows public instance
fields and non-indexed properties that can participate in ordinary XML serialization,
base object types, collection items, nullable value types, and explicit XML attribute
type references. It does not scan all subclasses. Ignored members and unannotated readonly scalar fields/getter-only scalar properties are
excluded; readonly collections and explicit XML declarations remain. The latter
preserve the game’s annotated readonly Netcode fields.
Custom XML serializers are terminal records because their CLR members do not define
the saved representation. Scalar and collection records contain shape metadata,
without traversing framework implementation properties.

Catalog format version 3 includes:

- Tool version, assembly version, informational game version, target framework,
  requested roots, and SHA-256 hashes of loaded assemblies from the game directory.
- Type identity, assembly, kind, base type, collection item type, explicitly declared assignable XML types,
  whether it is abstract, and whether it implements `IXmlSerializable`.
- Member names, value type references, and optional attributes. Field/property
  distinctions, declaring types, and accessor flags are not emitted; inherited
  saved members are included directly on each object type.
- XML serialization attributes and `DefaultValueAttribute` on types and members.
  Constructor arguments, named arguments, type references, enum encodings, nulls,
  arrays, and repeated attributes are retained. Absent settings stay absent.
- Diagnostics for types which could not be fully inspected.

Type IDs use recursive CLR names without assembly-qualified generic arguments;
for example, ``System.Collections.Generic.List`1[System.String]`` identifies a list
without repeating the runtime assembly version. JSON uses tabs. Empty metadata
collections, null optional type fields, and false metadata flags are omitted;
readers restore them as `[]`, `null`, and `false`. Explicit null attribute argument
values remain present. The validator accepts this format version only.

Inspection uses `MetadataLoadContext` and `GetCustomAttributesData`; it does not
execute game code or attribute constructors. Output is sorted for repeatability.
This is raw metadata, **not a generated XSD or complete serializer contract**.
Runtime attribute overrides, custom serializers, `ShouldSerialize*` methods,
`*Specified` members, and collection/default naming rules need further interpretation.
Explicit XML type references provide discovery evidence; runtime serializer setup may still add or override permitted types.

## Validate

```bash
dotnet run --project tools/game-data/extractor -- validate \
  --catalog /tmp/catalog.json \
  --save tests/TestSave \
  --output /tmp/comparison.json
```

`--save` is repeatable and accepts files or recursively searched directories.
Directory searches include extensionless saves by looking for an XML opening
character; explicit files always receive XML parsing diagnostics. DTDs and external
entities are prohibited.

The report compares observed root, element and attribute names against metadata,
including ordinary objects, collection wrappers/items, explicit namespaces,
`Form=Unqualified`, and resolvable `xsi:type` declarations. Unknown/ambiguous names
or malformed XML are `issues` and cause exit code `1`. Unsupported mappings,
custom XML serializers, unresolved polymorphism and depth-limited branches are
`unchecked`; these are reported but don't fail the command. Catalog diagnostics
also cause exit code `1`.

A successful exit means no issues were found in the supported comparison scope.
It does **not** establish full save validity. Scalar values, required members,
ordering, nullability, wildcard constraints, and all serializer defaults aren't
validated. Check `unchecked` as well as `issues`. Use a catalog from the same game
version as the save; version differences otherwise appear as metadata gaps.

## Unpack

Use [StardewXnbHack](https://github.com/Pathoschild/StardewXnbHack) for the repo's
JSON/PNG/TMX formats. Install the appropriate release and its required dependencies
in the selected game directory according to its README. Unlike inspection, this
external tool executes a temporary game instance and can need graphical/native
runtime support. The extractor doesn't install or download it automatically.

```bash
dotnet run --project tools/game-data/extractor -- unpack \
  --game-path "/path/to/Stardew Valley" \
  --output /tmp/unpacked \
  --asset Data/Objects --asset Portraits
```

`--unpacker <executable>` overrides the default `StardewXnbHack` executable in the
game directory. XnbHack always generates `Content (unpacked)` there; the extractor
then copies selected files to `--output`. Existing `Content (unpacked)` is rejected
to avoid silently using stale exports. Move it before a fresh run, or explicitly
reuse an existing export:

```bash
dotnet run --project tools/game-data/extractor -- unpack \
  --unpacked-path content \
  --output /tmp/selected-assets \
  --asset Data/Objects
```

`--asset` accepts a relative file, extensionless asset name or directory, and is
repeatable. Without it, all exported files are copied. Selection happens **after**
the external tool unpacks everything. Output must be new or empty and outside the
game/source directories. Existing files aren't overwritten. Runs have a five-minute
external-process timeout; failed runs may leave partial files for inspection.

`game-data-manifest.json` records tool version, selections, output hashes, the game
assembly hash, and the unpacker executable hash for fresh runs. Existing exports
are marked as having unverified game provenance. Unconverted `.xnb` files are
listed and cause exit code `1`. Fresh runs also report packed inputs with no exported counterpart as `missingAssets`. A failed external tool or absent export also fails.
For complete backend error details inspect its stderr logs: XnbHack can report
individual conversion failures without setting a failing process exit code.

## Verification

The Python standard-library integration suite builds a synthetic game-shaped
assembly and exercises the actual CLI. It needs .NET 10 and Python 3, no game:

```bash
python3 tools/game-data/tests/test_cli.py
dotnet format tools/game-data/extractor --verify-no-changes --no-restore
```

C# uses tabs (width 4), configured in `.editorconfig`; `dotnet format` preserves that convention.

Build outputs are ignored under this directory. NuGet versions are pinned in the
project and `packages.lock.json`; CI can restore with `dotnet restore --locked-mode`.

References:
[MetadataLoadContext](https://learn.microsoft.com/dotnet/standard/assembly/inspect-contents-using-metadataloadcontext),
[XML serialization attributes](https://learn.microsoft.com/dotnet/standard/serialization/attributes-that-control-xml-serialization).

## Effect Schema compiler experiment

The small TypeScript scaffold under [`schema/`](schema/README.md) compiles selected
catalog types to static Effect Schema XML codecs. Its README describes the workflow
for a catalog exported from the installed game and the current unsupported cases.
Local exports belong in the ignored `tools/game-data/workspace/` directory. The tool
uses Effect's native XML channels and stays separate from the production editor.

The catalog also records generic definitions and arguments. For the reviewed
`StardewValley.SerializableDictionary<,>` custom serializer, inspection follows
its key/value types without inspecting dictionary implementation members. Other
custom serializers remain opaque. Reinspect existing catalogs to add this metadata.

`SerializableDictionaryWithCaseInsensitiveKeys<TValue>` inherits that XML contract
with fixed string keys. Inspection follows its value argument; the schema compiler
uses ordinal case-insensitive duplicate detection while preserving saved key casing.

Types inheriting `Netcode.NetField<,>` also record `maxItems: 1`: their XML-facing
enumeration exposes one value, and Add rejects a second. This constrains NetRef
fields without limiting ordinary NetCollection lists. Refresh older catalogs to
include the bound; it does not change the compact array representation.

`Netcode.NetNullableEnum<T>` implements two enumerable interfaces. Inspection uses
its declared string enumerator for XML and still follows the generic enum argument
for its valid names. Refresh older catalogs which reported Nullable<T> as its item
type. Empty enum text is handled by the schema wrapper mapping, not by xsi:nil.

The reviewed `StardewValley.Inventories.Inventory` serializer follows its Item
payload during inspection. Its schema keeps null inventory slots as indexed
entries, including their xsi:nil XML, rather than compacting them into a list
of occupied items. Other custom enumerable implementations remain opaque.
