// These are effective XML contracts, not reflection records. Both generation and
// coverage consume them so names, collections and custom serializers agree.
internal sealed record ValueContract(string Kind, string? Type = null, ValueContract? Item = null,
	ValueContract? Value = null, ValueContract? Key = null, string? ItemName = null,
	string? KeyName = null, string? ValueName = null, string? KeyIdentity = null,
	List<string>? Labels = null, bool NullableText = false);
internal sealed record FieldContract(string MemberName, string XmlName, string Placement,
	ValueContract Value, string? ItemName = null, int? MaxItems = null)
{
	public bool Repeated => Placement == "repeated";
	public bool Multiple => Placement is "repeated" or "collection";
}
internal sealed record ObjectContract(string Id, string RootName, string TypeName, string TypeNamespace,
	bool IsAbstract, List<string> Variants, List<FieldContract> Fields);
internal sealed record CompilationContract(ObjectContract Root, List<ObjectContract> Objects);
