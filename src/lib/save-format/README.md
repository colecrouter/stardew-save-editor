# Typed XML codecs

The .NET tool inspects the game, resolves serialization rules, and emits static
TypeScript codecs for the browser. This directory contains their browser runtime; integration and behavior tests
live in `tools/game-data/tests` at the repository root. There is no TypeScript catalog compiler or original-XML patching layer.

## Generate

From the repository root:

```bash
# One step: inspect the selected installation and generate a root codec.
npm run game-data:generate -- --game-path "/path/to/Stardew Valley" \
  --output generated/save-format/save.ts

# Or compile a reproducible catalog snapshot.
npm run game-data:generate -- --catalog tools/game-data/workspace/catalog.json \
  --type StardewValley.SaveGame \
  --output generated/save-format/save.ts
```

The default root is `StardewValley.SaveGame`. `--runtime` selects the runtime file
when invoking the CLI outside the repository root. Output imports that file by a
relative path. Unsupported metadata fails with a member/type path before replacing
an existing output. Both inspection and generation belong to the .NET executable;
JSON catalogs are optional inspection artifacts, not a required compilation stage.

## Use

Generated modules export `ValueSchema` (typed-value validation), `XmlSchema` (XML text), and
`Value` (the decoded TypeScript type):

```ts
import { Schema } from "effect";
import { XmlSchema } from "./save.generated.ts";

const save = Schema.decodeSync(XmlSchema)(xml);
const edited = structuredClone(save);
// Change typed fields and ordinary arrays directly.
const output = Schema.encodeSync(XmlSchema)(edited);
```

There are no `.value`/`.original` object envelopes, hidden symbols, identity maps,
or XML templates. Ordinary objects expose their fields directly. Polymorphic
references use `$type` with a CLR type ID; concrete references accept an omitted discriminator. References that also occur
in polymorphic collections expose a consistent tag after decoding.
Boxed scalars under `System.Object` use `{ $type: "System.Int32", value: 7 }`, since
an untagged JavaScript number cannot distinguish CLR integer and floating types.
NetEnum network fields expose their single enum-name string instead of an
enumeration wrapper. The encoder generates `xsi:type`, `xsi:nil`, and their namespace declarations.

New objects can be literals satisfying the generated type. The schemas enforce
serialization constraints, not every gameplay invariant or constructor default.
In particular, absent optional members stay absent: creating a playable game object
may require more fields than deserializing a partial XML object.

## Representation and boundaries

- XML syntax uses Effect XML event channels. Known fields consume events directly
  into typed values; no parser-object tree or complete event buffer is created.
  Encoding emits events directly from values. Only unknown subtrees use a generic
  property representation. Field codecs determine scalar and collection meanings.
- Known fields convert in both directions. Unknown object properties remain ordinary
  cloneable data through an explicit rest record. A renamed known field owns its XML
  slot; ambiguous collisions fail rather than overwrite an unknown property.
- Missing optional members, empty wrappers and null values remain distinct where
  the game distinguishes them. Absent NetRef values normalize to null and cleared
  NetRefs serialize as omitted elements. Arrays
  retain null slot positions. Dictionaries are arrays of `{ key, value }` entries,
  retaining non-string keys and enforcing the registered CLR key comparer.
- Numeric limits, Int64/UInt64 bigint precision, binary32 rounding, float special
  values, GUIDs, enum labels and the reviewed nullable enum wrapper are explicit.
- Unknown object attributes/subtrees survive using a generic property representation
  with grouped sibling names; arbitrary mixed-content ordering is not preserved. Formatting, comments, processing instructions,
  original scalar spellings and attribute order are not preserved.
- Scalars, nulls, and arrays cannot carry XML wrapper metadata. Extra scalar
  attributes, nonempty nil elements, extra collection-wrapper properties, and extra
  dictionary payload-wrapper properties fail visibly. Ordinary object and dictionary
  entry extensions are retained.
- Element namespaces, binary byte arrays, multidimensional arrays, flags enums,
  explicit element-type overrides and unregistered custom serializers remain outside
  the supported contract. Type QNames and namespace aliases for `xsi:type`/`xsi:nil`
  are supported. Generation never substitutes an unknown codec for an unsupported
  known type.

The production editor imports the committed generated codec directly. Its domain
models use these plain values; the retained legacy editor continues to use its
older parser independently.

## Structure

- `../../../tools/game-data/Compilation/Metadata.cs`: attribute interpretation and XML names.
- `../../../tools/game-data/Compilation/ContractResolver.cs`: effective values, fields and variants.
- `../../../tools/game-data/Compilation/TypeScriptEmitter.cs`: static declarations and lazy references.
- `events.ts`, `xml.ts`: event readers/writers and the document boundary.
- `objects.ts`, `values.ts`, `dictionary.ts`: object and collection codecs.
- `scalars.ts`, `key-identities.ts`, `ordinal-ignore-case.ts`: scalar conversions
  and reviewed dictionary comparison semantics.
- `index.ts`: internal construction API imported by generated modules. Application
  consumers should import the generated schemas and types, not frame machinery.

Reader frames expose effectful `text`, `child`, and `finish` operations; opening a
codec is effectful as well. Expected XML/schema failures use `SchemaIssue` values
and receive their XML path at the document boundary. Unexpected exceptions remain
defects, so an implementation bug is not reported as a malformed uploaded save.

The coverage command consumes the same effective contracts as generation. It reports
unknown XML and unsupported metadata; it does not validate scalar values or gameplay.

## Verification

```bash
npm run test:game-data
npm run check:game-data
npx effect-tsgo diagnostics --project tools/game-data/tsconfig.json
dotnet format tools/game-data --verify-no-changes --no-restore
```

Preparation builds the CLI, regenerates the catalog fixture corpus under ignored
`tools/game-data/tests/generated/`, and builds a small synthetic game assembly. Generated files are
type-checked rather than committed as snapshots. Behavior tests cover conversion,
unknown data, creation/reordering, nullable slots, recursive contracts, boxed scalars,
and key equality. An end-to-end test inspects the synthetic assembly, generates its
codec, edits its XML and asks .NET XmlSerializer to deserialize the result. It needs
.NET 10 and Node 24, but no game installation or additional test-framework packages.

The Effect XML API is experimental in the pinned Effect version. In-memory
document decoding/encoding remains usable with `Schema.decodeSync`/`encodeSync`;
`decodeChunks(rootName, ValueSchema, chunks)` also accepts an iterable of text
chunks and returns an Effect. It consumes each event as it arrives and retains
only open reader frames and decoded data. It never calls the XML element-tree
collector. The generated codecs must be regenerated after this runtime change
so recursive references use `Xml.lazy`, which defers both schema and event handlers.

## Production editor

`generated/save-format/save.ts` is committed output used by the editor's save
service. Normal application builds need neither game files nor .NET. The editor
uses arrays for collections, `{ key, value }` dictionary entries, `null` for empty
inventory slots, and exact `bigint` values for CLR 64-bit integers. Network field
wrappers are handled by the codec; they do not appear as one-element arrays in the
editor. Concrete equipment references expose the same `$type` as inventory items.

The codec writes canonical XML, including necessary nil/type attributes. It does
not preserve whitespace, comments, numeric spelling, or attribute order. Unknown
object fields retain their generic XML representation. Unsupported known values
fail decoding instead of entering a partially typed editor model.

Unrecognized types at polymorphic boundaries use an explicit `$unknown` tag plus
`$xmlType` (name and namespace). Their fields remain generic and opaque to typed
editing; serialization retains the unknown type instead of substituting a base
class. This is semantic type information, not an original-document sidecar.
