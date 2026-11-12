# Effect Schema generation experiment

This is a small catalog-to-TypeScript compiler, separate from the production
editor. It generates static Effect Schema codecs, not a runtime catalog loader.
It uses the repository's Effect 4.0.6, matching Node platform services, and Node 24.
Dependencies are installed through the normal repository `npm ci`.

## Work with real exports

From the repository root, inspect the installed game into the ignored workspace:

```bash
dotnet run --project tools/game-data/extractor -- inspect \
  --output tools/game-data/workspace/catalog.json
```

Supply `--game-path` if installation discovery selects the wrong game version.
Then try compiling the save's actual root type:

```bash
npm run game-data:schema -- \
  --catalog tools/game-data/workspace/catalog.json \
  --type StardewValley.SaveGame \
  --output tools/game-data/workspace/save.generated.ts
```

This is the real-input development path, not a promise that full-save generation
already succeeds. The compiler stops at the first unsupported mapping with its
member path, and leaves any existing output unchanged. Work through those cases
against the real catalog rather than substituting a simplified sample type.

To compare that catalog with save XML independently of TypeScript generation:

```bash
dotnet run --project tools/game-data/extractor -- validate \
  --catalog tools/game-data/workspace/catalog.json \
  --save tests/TestSave \
  --output tools/game-data/workspace/comparison.json
```

Replace `tests/TestSave` with the save you want to inspect. This C# command reports
observed XML coverage, not full save validity; check both `issues` and `unchecked`.
Match the game installation version to the save where possible. Neither command
modifies the input save. Generated modules import the shared runtime by relative
path and `effect` by package name, so workspace outputs can run inside this repo.

## Start reading here

Start with `generate.ts`: it runs the three compiler stages below. None of
those stages reads files, runs the game, or evaluates generated code.

| File                         | Responsibility                                                                              | Why it is separate                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `compiler/catalog.ts`        | Validate inspector JSON and index CLR types by ID.                                          | The catalog format is an input protocol, not an XML codec.                                                         |
| `compiler/contract.ts`       | Interpret supported annotations into an XML contract.                                       | Decisions about names, collections and unsupported behavior can be understood before reading generated TypeScript. |
| `compiler/emit.ts`           | Render that contract as source composing Effect schemas.                                    | Emission should not reinterpret CLR attributes or decide serialization semantics.                                  |
| `compiler/emission-plan.ts`  | Allocate readable names, share matching inherited payloads, and plan recursive annotations. | These are source-layout choices after the XML contract is resolved.                                                |
| `compiler/value-emission.ts` | Reuse scalar, enum and repeated composed codecs and render their decoded types.             | Value reuse must preserve the existing codec and patch capabilities.                                               |
| `cli.ts`                     | Parse arguments, read a catalog, and write a module.                                        | File paths, scoped temporary files and process errors belong at the tool boundary.                                 |

The intermediate contract is a small in-memory value, not another output artifact
or user configuration. For example, `WorldDate.SeasonKey` becomes this field:

```json
{
	"memberName": "SeasonKey",
	"xmlName": "Season",
	"kind": "element",
	"value": { "kind": "scalar", "type": "System.String" }
}
```

Resolution got `Season` from the member's XmlElement annotation. Emission can
bind `Xml.scalarValues["System.String"]` using `Xml.field("Season", definition)`
without interpreting that annotation again. Scalar definitions are lifted from
the codec registry; the emitter has no separate scalar conversion switch.
`resolveContract` is pure and can be inspected independently in a debugger.

## What the generated code uses at runtime

Generated files import `xml-codecs.ts`. That remains the public entry point:

| File                  | Responsibility                                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------------- |
| `xml-codecs.ts`       | Compose typed fields with their original XML tree, compare edits, and expose tree/string Effect Schema codecs. |
| `runtime/fields.ts`   | Locate the XML slot each field owns and patch only that slot; retain unknown siblings and attributes.          |
| `runtime/xml-tree.ts` | Define the ordered tree, convert Effect XML events to/from it, and read/replace scalar text.                   |

At runtime, Effect parses XML text into a tree. Field bindings select elements
or attribute text; value definitions own conversion to typed values. The
result is an envelope with `.value` and `.original`, because a typed object alone
would lose XML we do not yet understand. Nested objects have the same envelope:
`order.value.Shipping.value.City` is typed text, while
`order.value.Shipping.original` retains that child's unknown XML.

During encoding, value definitions produce canonical values or edited child trees. We
compare decoded old/new values using schema-derived equivalence before patching: an unchanged integer written as `0007` should retain that
spelling, even though its canonical encoding is `7`. Only changed fields are
patched into a copy of `.original`. The unknown parts of the tree remain there. Schema-derived comparison also handles
nested envelopes and bigint values, without converting them to JSON.

## Composable XML values

```ts
const schema = Xml.structure({
	count: Xml.field("count", Xml.nullable(Xml.UInt32)),
	version: Xml.attribute("version", Xml.UInt32),
	state: Xml.field("state", Xml.nullable(Xml.enumeration(["Ready", "Old"]))),
});
```

`runtime/values.ts` defines the value abstraction. A definition supplies an element
codec and an edit patcher; text-capable definitions also supply a text codec for
attributes. Scalar conversions still use text internally, but callers compose
`Xml.nullable(Xml.UInt32)` without an explicit text adapter. Named scalar values
are convenience aliases for `Xml.scalarValues["System.UInt32"]`, lifted from the
single scalar registry. They retain their text Schema surface for compatibility
with existing direct decode/encode calls.

`Xml.field`, `Xml.list`, and `Xml.repeatedValues` own element names, placement and
cardinality. `Xml.attribute` requires a text-capable definition. Nullable and array values
have no attribute/text capability, so binding one to an attribute fails during
TypeScript checking and at runtime. `Xml.value(codec)` lifts an existing object or
custom serializer codec; `Xml.nullable` also accepts an element codec directly.

The nullable wrapper handles namespace-aware xsi:nil and delegates non-null values
to the underlying definition. The same nil helpers preserve alias spellings,
comments and safe prefix bindings for nullable scalars, enums and Inventory slots.
Ordinary scalar fields still decode to plain values; object values retain their
existing envelopes. Missing-element behavior remains a binding concern: a
required nullable element must be present, either with a value or xsi:nil.

`Xml.optional(Xml.field("label", Xml.String))` makes XML presence optional without
changing the value definition. It uses an exact optional property: missing XML
means no own property in `.value`, an empty element is still an empty string, and
an explicit nil is accepted only by a nullable definition. Assigning an absent
property inserts its XML slot; removing a property deletes that slot. Explicit
`undefined` is rejected. Wrapped lists and attributes support the same wrapper;
unwrapped repetitions already represent absence as an empty array.

The compiler applies this presence policy to ordinary CLR members. XmlSerializer
accepts missing members and leaves their CLR/constructor defaults untouched, but
the saved-data view does not execute constructors or invent those defaults. For
example, an omitted gameVersionLabel remains absent. Custom dictionary key/value
wrappers retain their required contract. Existing required runtime bindings and
older generated fixtures remain valid; regenerate a module to adopt this policy.

The compiler resolves System.Nullable<T> for supported scalars/enums into this
wrapper. Nullable collection items retain their underlying payload name (`int`,
not `NullableOfInt32`). NetNullableEnum remains its separate reviewed empty-text
adapter; it does not acquire xsi:nil semantics.

## Generated codec API

Once a type compiles, its module exports `FragmentSchema` for XML trees and
`FragmentXmlSchema` for XML text. Decoding returns `{ type, value, original }`. Keep the
original envelope while editing typed values, then encode with Effect Schema.
Nested objects use the same envelope so each child preserves its own unknown XML.
Regenerated object envelopes also have a literal CLR `type` discriminator, allowing
TypeScript to narrow `.value` when a declared field has several concrete variants.

The root schema currently accepts a fragment without a document declaration,
not an entire XML document. Full-save support still requires the mappings and
runtime boundaries listed below; the production editor does not use this tool yet.

## Adding support

### Another scalar type

Add an entry in `mappings/scalars.ts` with `codec` and `xmlItemName`, then add a
round-trip/range test and regenerate any modules that use it. The codec must encode
XML text, not a JS number. Its decoded type is inferred directly in generated
schemas. `System.Int64` is an example: its single registration supplies the `long`
item name and a bounded bigint codec. No resolver or emitter conversion case is needed. The registry automatically
lifts the codec into `scalarValues`; named convenience aliases live in
`runtime/scalar-values.ts`.

### Another ordinary object type

No registration is needed. If the catalog contains a non-custom `object`, the
resolver follows its members and emits a reusable `Xml.structure(...)` definition.
Shared child types are emitted once, before their parents. The parent binding
supplies the actual XML element name, so the same CLR type can be Shipping and
Billing even when it declares a different XmlRoot name.

### Type-level annotations and polymorphism

`mappings/type-annotations.ts` is the registration point for class/type metadata.
XmlRoot determines the document element; XmlType determines the expanded XML type
name; XmlInclude adds a known serialization type to the reachable graph.

Includes are not necessarily subclasses of the annotated owner. SpecialOrder, for
example, includes objective and reward types. The resolver discovers those types
across the graph, then filters the alternatives for each declared field by its CLR
base chain. An unrelated included type never becomes a variant of the owner.

Reinspect the game before generating polymorphic schemas: the inspector now emits
`isAbstract`. An abstract base cannot be decoded without a concrete `xsi:type`.
Older catalogs without that flag cannot distinguish abstract and concrete bases.

Generated codecs select variants by expanded XML type name, not by field presence
or a hardcoded `xsi` prefix. Prefix bindings inherited from ancestor elements are
retained as parser context; XML type namespaces can therefore be supported without
adding namespace support for element names. Unknown, unbound or ambiguous types
fail rather than falling back to a base schema. Concrete base types accept an
absent discriminator. Encoding preserves existing valid prefixes, and adds a
binding/discriminator when the selected derived case requires one.

Each decoded object has `type`, `value`, and `original`. For a polymorphic field,
check `field.type` before accessing derived-only fields in `field.value`. Retain
its envelope when editing so its discriminator and unknown XML remain available.
Scalar/enum polymorphism remains unsupported. Recursive object graphs use the
lazy generation path described below.

### XML names for constructed generic types

`mappings/type-names.ts` separates standalone root names from collection item/type
names. It follows `genericDefinition` and `genericArguments` rather than splitting
constructed CLR IDs, which can contain namespaces and brackets inside arguments.
For example, a collection of SerializableDictionary<long, Inventory> uses
`SerializableDictionaryOfInt64Inventory` as its item name, while the dictionary's
standalone XmlRoot remains `dictionary` and an Inventory payload root is `items`.

Generic defaults use CLR argument names (`Int64`), not scalar XML item names
(`long`) or an argument's XmlType override. Direct collection items still honor
XmlType; explicit XmlArrayItem names override defaults. These distinctions were
checked against a .NET XmlSerializer probe, including nested generic dictionaries.
Incomplete generic naming metadata requests reinspection; cyclic metadata
fails explicitly instead of yielding a bracket fragment as an XML name.

### Nullable enum text wrappers

`mappings/enum-wrappers.ts` registers Netcode.NetNullableEnum. This wrapper hides
its inherited nullable-value enumerator with a string enumerator and Add(string).
The inspector therefore records `elementType: System.String` while retaining its
generic enum argument, and follows that argument so its labels enter the catalog.
Reinspect older catalogs before generating these fields.

The generated field is an array of enum labels or null, limited to one item.
For `preserve`, absence decodes to `[]`, `<preserve/>` to `[null]`, and
`<preserve>Jelly</preserve>` to `["Jelly"]`. The game accepts absent and empty
forms as no value. We retain their distinct presence during round trips; encoding
`[null]` writes an empty element and encoding `[]` removes it.

The wrapper uses CLR enum names through Enum.ToString/Enum.Parse, bypassing XmlEnum
aliases. Ordinary enum fields continue using XmlEnum labels. Unknown labels,
numeric enum aliases and flags combinations remain rejected deliberately.
This mapping is distinct from the CLR Nullable<T> wrapper and its xsi:nil support.

### Recursive types and single-value references

The resolver records an object reference by CLR ID when it encounters a declaration
already being visited. `compiler/graph.ts` groups object, dictionary payload, and
variant edges into strongly connected components. Only actual recursive groups
need explicit schema annotations; acyclic leaf schemas and acyclic parents of
cycles infer their types. Base payload types needed by recursive intersections
remain explicit too. Suspended object references make the generated initialization
order safe without runtime catalog loading.

The output stays in one module. CLR names produce declarations such as
`FarmerFields`, `FarmerValueSchema` and `FarmerSchema`; namespace collisions use
qualified names, and generated suffixes are reserved to prevent collisions.
Shared inherited field maps are spread into derived payloads only when all base
slots are still present. Changed mappings override the base binding and use Omit
in explicit payload types; removed/ignored slots fall back to a local field map.
Inheritance shares payloads, not polymorphic discriminator unions.

Scalar and enum codecs get named declarations, and repeated nullable, array,
dictionary and inventory definitions are reused. Repeated concrete discriminator
codecs and explicit union cases are shared separately. A concrete declared type's
permission to omit xsi:type stays separate from its stricter derived-case codec.
These changes reduce source repetition without changing XML or decoded envelopes.

A recursive type permits finite nested XML, not cyclic JavaScript values. Every
branch must still end in a supported shape such as an absent optional child or
an empty collection. Nil is accepted only by a nullable definition. The parser
retains its 128-level nesting limit.

Reinspect catalogs to capture `maxItems: 1` for types inheriting Netcode.NetField.
That implementation exposes one value through IEnumerable and rejects a second
Add; NetRef inherits this behavior. A collection annotated with XmlElement therefore
keeps the existing array representation, but its field schema rejects more than
one value during decode and encode. Absence means an empty array. Ordinary
NetCollection instances have no such bound. Older catalogs omit this metadata
and cannot enforce the limit.

### Known custom serializers

`mappings/custom-serializers.ts` registers reviewed custom serializer contracts.
The inspector emits `genericDefinition` and `genericArguments`; reinspect older
catalogs before generating dictionaries. The recognized
`StardewValley.SerializableDictionary<,>` causes its key/value types to be explored;
Inventory separately follows its Item payload.
Other IXmlSerializable implementations still fail explicitly.

Dictionary XML is a sequence of `item` elements, each containing `key` and `value`
wrappers around separately serialized payloads. `runtime/dictionary.ts` composes
those wrappers with the normal scalar, enum, and object codecs. Internal `boxed`
and `boxedObject` field slots preserve wrapper attributes and unknown children;
they are serializer building blocks rather than CLR annotation mappings.

A decoded dictionary is `{ value: entries, original }`. Each entry is
`{ value: { key, value }, original }`, so a string dictionary value is accessed as
`dictionary.value[0].value.value`. Object values retain their own typed envelopes.
The ordered array preserves entry provenance and supports non-string scalar keys
without JS property coercion. Duplicate decoded keys fail during decode and encode.
An empty dictionary element is valid. An absent optional dictionary member stays
absent; it does not become an empty dictionary. Each present entry still requires
both its key/value wrappers and their serialized payloads.

The codec accepts the game's legacy integer payloads for string keys/values and
LocationContext payloads for string keys. Unchanged aliases are preserved; edits
write the canonical string element. Unregistered object keys, null dictionary
payloads, and custom dictionary comparers are not supported. New entries currently require a preserved template,
just like other object collections. The XML contract was checked against the
installed game's SerializableDictionary.ReadXml/WriteXml implementation.

### Array and list values

`Xml.array(Xml.Int32)` is a composable element-valued definition for an ordered
array. Use it in a field or another value wrapper, for example
`Xml.field("numbers", Xml.nullable(Xml.array(Xml.Int32)))`. Scalars supply their
XML item names from the registry; an enum/object definition without a default name
needs an explicit second argument such as `Xml.array(itemDefinition, "Item")`.

Native one-dimensional CLR arrays can now appear as dictionary values and other
serializer payloads, not only as fields. The compiler emits ArrayOfInt/int naming
for int[] and ArrayOfArrayOfInt/ArrayOfInt for jagged int[][], checked against a
.NET XmlSerializer probe. Generic CLR names remain distinct: an int[] argument
contributes ArrayOfInt32 to a constructed dictionary's default type name.

Ordinary `System.Collections.Generic.List<T>` payloads use the same codec. In
particular, `globalInventories` is a dictionary of strings to `List<Item>`: each
value contains an `ArrayOfItem` with polymorphic `Item` elements and nullable
slots. List<int> uses ArrayOfInt/int, nested lists use ArrayOfArrayOfInt/ArrayOfInt,
and List<byte> uses ArrayOfUnsignedByte/unsignedByte (unlike binary byte[]).
As a CLR generic argument, List<int> still contributes ListOfInt32 rather than
ArrayOfInt. The shared recognition and metadata checks live in
`mappings/sequences.ts`; arbitrary enumerable types are not treated as lists.

`mappings/collection-items.ts` supplies the shared null-slot rule for these
payloads and wrapped collection fields. Wrapped reference items are nullable by
default: for example, a NetString ColorName containing `<string xsi:nil="true"/>`
decodes as `[null]`. Its one-item bound still applies. Empty wrappers decode as
`[]`, while absent optional wrappers remain absent. `XmlArrayItem(IsNullable=false)`
keeps reference items non-null. Unwrapped XmlElement repetitions retain their
non-null default because .NET omits null items in that placement. Non-nullable
value-type scalar, enum and struct items do not acquire nil support.

Arrays decode to plain readonly arrays. The containing field/entry keeps their
original XML, and array patching reuses existing slots to preserve wrapper
attributes, unknown siblings, comments, and unchanged scalar spelling. Object
items retain their own envelopes; recursive references through arrays stay lazy.
Reference-type and Nullable<T> items use the nullable wrapper, retaining null
positions instead of compacting the array. A missing required array payload still
fails; an existing empty element is an empty array.

Dictionary payload bindings now use the value definition's patcher for these
arrays, rather than replacing the whole payload with canonical XML. Binary byte[]
and rectangular/multidimensional arrays remain unsupported. Standalone collection
values other than List<T> need separate reviewed mappings; this does not infer
arbitrary enumerable serializer contracts.

### Object dictionary key identities

The dictionary codec accepts object keys through the same preserved object codecs
used for values. Equality is selected separately in `mappings/key-identities.ts`:
registrations include StardewValley.FarmerPair (two Int64 fields compared in order)
and Microsoft.Xna.Framework.Vector2 (component-wise float comparison). Their
schema projections retain only the decoded identity fields,
not the CLR discriminator, original XML, numeric spellings, or unknown children.

`keyComparisonSchema` applies Schema.overrideToEquivalence to a separate decoded
schema view. Duplicate detection derives Schema.toEquivalence from that view;
the original key codec and entry schemas remain untouched. This distinction lets
duplicate detection ignore provenance while ordinary edit detection still notices
XML-only key edits. Ordinary dictionaries keep their existing scalar/enum comparison.

`SerializableDictionaryWithCaseInsensitiveKeys<TValue>` inherits the same XML
format, fixes its keys to strings, and selects the `ordinalIgnoreCase` comparison
policy. Duplicate keys are rejected on both decode and encode; saved key casing,
entry order, and XML provenance remain intact. A case-only key edit still writes
the new spelling. The inspector follows the subclass's value argument, including
object or enum payload metadata.

Ordinal comparison uses the checked-in simple casing table in
`mappings/ordinal-case-table.ts`, captured from .NET's actual comparer. It does not
use locale comparison, Unicode normalization, or full uppercase expansions:
`é`/`É` compare equal, while `ß`/`SS` and dotless `ı`/`I` remain distinct. The table
also covers supplementary characters and Greek simple uppercase mappings. Pinning
it avoids changing duplicate detection with JavaScript's Unicode version. To
refresh it when reviewing the supported .NET casing policy, use the .NET 10 SDK:

```bash
dotnet run --file tools/game-data/schema/scripts/GenerateOrdinalCaseTable.cs > tools/game-data/schema/mappings/ordinal-case-table.ts
npx oxfmt --write tools/game-data/schema/mappings/ordinal-case-table.ts
```

FarmerPair.MakePair sorts newly created IDs, but FarmerPair.Equals compares the
stored fields without sorting; decoding and encoding preserve the saved order.
Both decoded keys and edited keys are checked for duplicates. Object keys retain
the usual envelope, so a field is accessed as `entry.value.key.value.Farmer1`.

Vector2.Equals in the installed MonoGame assembly compares X and Y with float ==.
The registered comparison equates signed zeros and equal infinities, but NaN is
unequal even to itself. It is supplied directly through the comparison schema's
override, without a reference-equality shortcut. This intentionally matches CLR
key comparison even where NaN makes it non-reflexive. The ordinary Single codec's
Object.is comparison remains unchanged for XML edit detection and preservation.

Other object-key types require a reviewed registration. The compiler checks the
registered struct's member names/types and base type before using its identity;
a changed game shape fails instead of silently excluding new equality fields.

### XNA types present in the inspected catalog

These are ordinary serializable structs/enums; they use the existing scalar,
object, enum and array machinery rather than another custom XML serializer.

| Type       | Captured representation                         | Known use                                              |
| ---------- | ----------------------------------------------- | ------------------------------------------------------ |
| Vector2    | X/Y Single fields                               | Positions and dictionary keys; registered key identity |
| Point      | X/Y Int32 fields                                | Integer coordinates, including Rectangle projections   |
| Rectangle  | X/Y/Width/Height and Point-valued Location/Size | Bounds                                                 |
| Color      | Byte R/G/B/A plus UInt32 PackedValue            | Lighting and colors                                    |
| Vector3    | X/Y/Z Single fields, including jagged arrays    | DesertFestival raceTrack and Serpent segments          |
| Input.Keys | Enum labels                                     | InputButton.key                                        |

The current catalog has Vector2-keyed dictionaries; the other listed XNA types do
not currently occur as dictionary keys. Any future key use still requires a review
of the type's equality behavior before registering an identity.

### Inventory slots

The custom serializer registry also recognizes the exact
`StardewValley.Inventories.Inventory` type. Inspection follows its Item payload;
compilation reuses the ordinary polymorphic Item schema for occupied slots.
`runtime/inventory.ts` owns the reviewed `items` / repeated `Item` layout and nil
handling. Other object codecs retain their existing rejection of xsi:nil unless explicitly
wrapped with Xml.nullable.

A decoded inventory is `{ value: slots, original }`. Each slot is
`{ value: itemEnvelopeOrNull, original }`: `inventory.value[index].value` is null
for an empty slot or the usual `{ type, value, original }` item envelope. Keep the
slot envelope when clearing it; use an item's preserved envelope when filling it.
An empty inventory has zero slots. Empty slots remain entries in the array, so
round trips and item edits cannot compact them or shift subsequent indices.

Nil attributes are matched by expanded name, including inherited prefix aliases.
The codec accepts true/1 and false/0, preserves original spellings on no-op export,
and rejects duplicate attributes, invalid boolean text, and nil nodes carrying
an item payload or type discriminator. Clearing an occupied slot intentionally
removes its payload and discriminator while retaining slot attributes/comments.
Filling or replacing it uses the selected item's own XML. Moving an empty slot
retains that slot's original tree. The slot envelope preserves Inventory indices; the nullable value behavior is
shared with ordinary explicitly nullable definitions.

### Another XML structure

Start in `mappings/structures.ts`. The current registrations are:

| Kind             | Decoded slot                  | Runtime representation before field decoding |
| ---------------- | ----------------------------- | -------------------------------------------- |
| `attribute`      | Scalar attribute              | Text                                         |
| `element`        | Scalar child element          | Text                                         |
| `object`         | Nested child object           | XML element                                  |
| `collection`     | Wrapped scalar/enum list      | Text array                                   |
| `objects`        | Wrapped object list           | XML element array                            |
| `elements`       | Repeated scalar/enum siblings | Text array                                   |
| `objectElements` | Repeated object siblings      | XML element array                            |

Define its binding data in `StructureBindings`, then register its factory,
selector and replacement function in `structures`. The `builder` property chooses
the generated placement call and `multiple` describes decoded multiplicity for
recursive types. Conversion and value-specific patching stay in the value
definition. Legacy text/object factories remain available for older generated
modules; newly generated fields use the shared value builders.

Then update **`resolveField` in `compiler/contract.ts`** to explain when CLR metadata
selects that new shape. This classification is separate from runtime registration:
for example, XmlElement means `element` for a scalar and `object` for an object.
If the shape introduces an entirely new meaning (such as choice elements),
extend its contract and tests deliberately rather than
pretending an existing slot can represent it.

## Current boundaries and reasons

- The compiler validates catalog format 3 and supports nested objects,
  strings, Bytes, Int32s, Int64s, Singles, Doubles, GUIDs, booleans, enum labels, CLR nullable scalar/enum values, nullable enum text
  wrappers, scalar attributes, and wrapped
  scalar/enum/object collections, and unwrapped repetitions declared with
  XmlElement on a collection. Other types and annotations fail rather than
  becoming `Schema.Unknown`. Recursive object contracts use explicit TypeScript
  types and lazy schema references.
- Ordinary objects with no saved members use an empty `.value` object and retain
  their original XML. For example, `System.Random` serializes as `<mineRandom />`;
  this models its empty XML contract, not its internal random generator state.
  Missing type records and unknown custom serializers still fail generation.
- `System.Object` accepts a tagged union of registered scalars and known ordinary
  object types, using `{ type, value, original }` for both. Dispatch matches the
  namespace-qualified `xsi:type`, so `xsd:int`, the game's `Object`, and XML Schema's
  `anyType` remain distinct. Known objects include types reached through saved
  members and explicit XmlInclude declarations; this permits nested
  DescriptionElement substitutions. Scalar spelling and unknown XML are preserved.
  Unknown types, unregistered scalar types, enum/collection payloads, and custom
  serializers are not inferred from their contents. This mapping does not add
  xsi:nil support; nullable values still require an explicit nullable wrapper.
- Present singular fields and collection wrappers must appear exactly once.
  Generated ordinary members are optional: an absent wrapper stays absent rather
  than becoming an empty list or a guessed serializer default. Manually required
  bindings still reject absence. An existing empty wrapper is a valid empty
  collection. Unknown wrapper children remain in the tree.
  Unwrapped collections have no required wrapper: zero matching direct children
  decode as an empty list. Descendants inside other elements are not list items.
- Byte uses bounded decimal integers from 0 through 255 and the XML item name
  `unsignedByte`. Decode and encode reject fractions and out-of-range values.
  Binary byte arrays remain unsupported: their base64 XML representation is not
  an ordinary list of Byte elements.
- Int32 checks decimal integer syntax and the signed 32-bit range. Int64 uses
  bigint with signed 64-bit bounds, preserving values beyond JS's safe integer
  range. Booleans accept
  XML spellings `true`, `false`, `1`, and `0`. Field codecs own both directions of
  conversion, so field selection and patching do not duplicate those rules.
- Single uses JS numbers rounded to binary32 for decode and encode, including
  subnormals, underflow and signed zero. It accepts decimal/exponent syntax and
  XML's `INF`, `-INF`, and `NaN` tokens. Decimal or edited-number overflow is
  rejected rather than silently converted to infinity; explicit infinities remain
  valid. Edited finite values emit decimal text that round-trips to the rounded
  float; it need not match .NET's shortest spelling. Unedited text is retained.
  See [.NET XML numeric conversions](https://learn.microsoft.com/en-us/dotnet/standard/data/xml/converting-strings-to-dotnet-data-types).
- Double uses the same XML float grammar and special tokens as Single but keeps
  JavaScript's native binary64 precision, including signed zero and subnormals.
  It rejects decimal text that overflows to infinity and preserves unchanged
  XML spellings. `Xml.Double` composes directly with `Xml.nullable`.
- Guid uses a string branded as `System.Guid`. The codec validates the 8-4-4-4-12
  hexadecimal D format emitted by XmlSerializer, without UUID version/variant
  restrictions, so all-zero and arbitrary GUID values are valid. It accepts either
  hex case, decodes to lowercase, and emits lowercase for edits; unchanged source
  spelling remains preserved. Compact/braced forms and surrounding whitespace are
  outside this codec's accepted format. `Xml.Guid` exports both the value definition
  and its branded type, and composes with nullable/array definitions.
- Element namespaces, nil on non-nullable definitions, flags enums, unregistered custom XML
  serializers, scalar defaults/optionality, and other numeric types are future work.
  This is not an XSD validator or a complete save codec.
- Parsing/printing use `effect/encoding/Xml` channels. Its event API is experimental
  in Effect 4.0.6, deliberately used here. We retain its events in an ordered tree
  because its built-in element collector drops comments and processing instructions.
- The experiment accepts a single root fragment without declarations, DOCTYPE,
  or document-level comments/processing instructions. Parsing is bounded to depth 128. XML syntax failures become schema issues at the string codec boundary.
- Preservation is semantic, not byte-for-byte XML preservation. Effect normalizes
  XML line endings, references, CDATA and attribute whitespace. Printing can change
  quote style and self-closing tags. Unchanged scalar spellings such as `0007`
  survive the typed round trip; editing a field emits its canonical encoding.

Scalar collection editing reuses existing item positions/attributes. Object items
carry their own `.original` envelopes; moving or inserting one therefore carries
its unknown XML with it. Both forms keep unknown wrapper siblings in place. New
items follow the last old slot; with no old items, they precede existing wrapper
children. This is not an identity-aware collection reconciler.

Unwrapped lists follow the same replacement rule, but append to the parent when
there are no existing item slots. Their XML shape comes from XmlElement on the
collection member; the collection implementation (such as NetCollection) does
not need a special runtime codec.

To insert an object, provide a valid envelope (for example, a decoded template); creating object XML
from bare values isn't implemented.

## Checks

```bash
npm run check:game-data:schema
npm run test:game-data:schema
npx effect-tsgo diagnostics --project tools/game-data/schema/tsconfig.json
```

Synthetic inputs and generated modules live under `tests/fixtures/` solely for
regression tests. There are no runnable demos or example-generation workflow.

Tests cover typed inference, native XML text conversion, invalid values, duplicate
and missing fields, nested object and collection edits, Int64 precision, shared
child types, XmlInclude discovery, abstract bases, QName dispatch, preservation,
recursive references, reference cardinality and unsupported catalog mappings. Experimental XML API warnings are expected and reviewed; the
scaffold intentionally depends on that newly available API.
