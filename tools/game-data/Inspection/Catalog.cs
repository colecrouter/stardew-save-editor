using System.Text.Json.Serialization;

// Raw attribute records retain argument types, repeated attributes, and absent
// settings. Effective serializer defaults belong to a separate interpretation.
public sealed record AttributeValue(string Type, object? Value);
public sealed record AttributeRecord(string Type, List<AttributeValue> ConstructorArguments, SortedDictionary<string, AttributeValue> NamedArguments)
{
	// Compact catalogs omit empty collections. A parameterless JSON constructor
	// restores those defaults while preserving absent attribute settings.
	[JsonConstructor]
	public AttributeRecord() : this("", [], new(StringComparer.Ordinal)) { }
}
public sealed record MemberRecord(string Name, string Type, List<AttributeRecord> Attributes)
{
	[JsonConstructor]
	public MemberRecord() : this("", "", []) { }
}
// Abstractness prevents generated polymorphic codecs from treating an abstract
// declaration as a concrete fallback when saved XML omits xsi:type.
public sealed record TypeRecord(string Id, string Assembly, string Kind, string? BaseType, string? ElementType, int? MaxItems, bool CustomXml, bool IsAbstract, string? GenericDefinition, List<string> GenericArguments, List<string> DerivedTypes, List<AttributeRecord> Attributes, List<MemberRecord> Members)
{
	[JsonConstructor]
	public TypeRecord() : this("", "", "", null, null, null, false, false, null, [], [], [], []) { }
}
public sealed record AssemblyRecord(string Name, string Version, string File, string Sha256);
public sealed record Catalog(int FormatVersion, string ToolVersion, string? GameVersion, string AssemblyVersion, string? Framework, List<string> Roots, List<AssemblyRecord> Assemblies, List<TypeRecord> Types, List<string> Diagnostics);
