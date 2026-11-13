using System.Text.Json;
using System.Text.RegularExpressions;

internal sealed class Metadata
{
	public const string Xml = "System.Xml.Serialization.";
	public const string Xsd = "http://www.w3.org/2001/XMLSchema";
	public readonly Dictionary<string, TypeRecord> Types;
	// Runtime codecs use the same CLR IDs. This table owns compiler XML names;
	// runtime scalar tests independently check each supported conversion.
	public static readonly Dictionary<string, string> Scalars = new(StringComparer.Ordinal)
	{
		["System.String"] = "string",
		["System.Boolean"] = "boolean",
		["System.Byte"] = "unsignedByte",
		["System.Int32"] = "int",
		["System.UInt32"] = "unsignedInt",
		["System.Int64"] = "long",
		["System.UInt64"] = "unsignedLong",
		["System.Single"] = "float",
		["System.Double"] = "double",
		["System.Guid"] = "guid"
	};
	public Metadata(Catalog catalog)
	{
		if (catalog.FormatVersion != 3)
			throw new InvalidDataException("Unsupported catalog format version.");
		if (catalog.Diagnostics is null || catalog.Types is null)
			throw new InvalidDataException("Missing catalog types or diagnostics.");
		if (catalog.Diagnostics.Count != 0)
			throw new InvalidDataException("Catalog is incomplete: " + string.Join("; ", catalog.Diagnostics));
		Types = new(StringComparer.Ordinal);
		foreach (var type in catalog.Types)
		{
			if (string.IsNullOrEmpty(type.Id) || !Types.TryAdd(type.Id, type))
				throw new InvalidDataException("Missing or duplicate catalog type ID: " + type.Id);
			// Omitted collections have constructor defaults; explicit nulls and
			// malformed kinds are input errors rather than later traversal defects.
			if (type.Kind is not ("object" or "scalar" or "enum" or "nullable" or "collection") || type.Members is null || type.Attributes is null || type.GenericArguments is null || type.MaxItems is <= 0)
				throw new InvalidDataException($"{type.Id}: invalid type metadata");
			if (type.Members.Any(m => string.IsNullOrEmpty(m.Name) || string.IsNullOrEmpty(m.Type) || m.Attributes is null))
				throw new InvalidDataException($"{type.Id}: invalid member metadata");
			foreach (var attribute in type.Attributes.Concat(type.Members.SelectMany(m => m.Attributes)))
				if (string.IsNullOrEmpty(attribute.Type) || attribute.NamedArguments is null || attribute.ConstructorArguments is null)
					throw new InvalidDataException($"{type.Id}: invalid attribute metadata");
		}
	}
	public TypeRecord Require(string id) => Types.GetValueOrDefault(id) ?? throw new InvalidDataException($"Missing type metadata: {id}");
	public static object? Unwrap(AttributeValue? value) => value?.Value is JsonElement element ? element.ValueKind switch
	{
		JsonValueKind.Null => null,
		JsonValueKind.String => element.GetString(),
		JsonValueKind.True => true,
		JsonValueKind.False => false,
		JsonValueKind.Number => element.GetInt64(),
		_ => element
	} : value?.Value switch
	{
		// Reflection and JSON expose integral enum arguments using different CLR
		// numeric boxes. Normalize both paths before interpreting attribute settings.
		byte number => (long)number,
		short number => (long)number,
		int number => (long)number,
		_ => value?.Value
	};
	public static object? Named(AttributeRecord? attribute, string key) => attribute is null ? null : Unwrap(attribute.NamedArguments.GetValueOrDefault(key));
	public static string Name(AttributeRecord? attribute, string setting, string fallback)
	{
		var value = Named(attribute, setting) ?? Unwrap(attribute?.ConstructorArguments.FirstOrDefault(a => a.Type == "System.String")) ?? fallback;
		if (value is not string text)
			throw new InvalidDataException($"{fallback}: XML name must be text.");
		return text.Length == 0 ? fallback : text;
	}
	public static void PlainName(string name)
	{
		if (!Regex.IsMatch(name, "^[A-Za-z_][A-Za-z0-9_.-]*$"))
			throw new InvalidDataException($"Unsupported XML name: {name}");
	}
	public string ClrName(string id, HashSet<string>? active = null)
	{
		active ??= [];
		if (!active.Add(id))
			throw new InvalidDataException($"{id}: recursive generic naming metadata");
		try
		{
			var type = Types.GetValueOrDefault(id);
			if (id.EndsWith("[]", StringComparison.Ordinal) && type?.ElementType is { } item)
				return "ArrayOf" + ClrName(item, active);
			if (type?.GenericDefinition is not { } definition)
			{
				if (id.Contains('[') || id.Contains('`'))
					throw new InvalidDataException($"{id}: generic naming metadata is missing");
				return id.Split('.', '+').Last();
			}
			var name = definition.Split('.', '+').Last();
			var arity = Regex.Match(name, "`([0-9]+)$");
			if (!arity.Success || type.GenericArguments.Count != int.Parse(arity.Groups[1].Value))
				throw new InvalidDataException($"{id}: incomplete generic naming metadata");
			return name[..arity.Index] + "Of" + string.Concat(type.GenericArguments.Select(arg => ClrName(arg, active)));
		}
		finally { active.Remove(id); }
	}
	public (string Root, string Type, string Namespace) Names(string id)
	{
		var record = Require(id);
		var fallback = id == "System.Object" ? "anyType" : ClrName(id);
		var root = fallback;
		var name = fallback;
		var ns = id == "System.Object" ? Xsd : "";
		foreach (var attribute in record.Attributes)
		{
			switch (attribute.Type)
			{
				case Xml + "XmlRootAttribute":
					Settings(attribute, ["ElementName", "Namespace", "IsNullable"], id);
					if (Named(attribute, "Namespace") is string { Length: > 0 })
						throw new InvalidDataException($"{id}: root namespaces are unsupported");
					root = Name(attribute, "ElementName", root);
					break;
				case Xml + "XmlTypeAttribute":
					Settings(attribute, ["TypeName", "Namespace"], id);
					name = Name(attribute, "TypeName", name);
					ns = Named(attribute, "Namespace") as string ?? "";
					break;
				case Xml + "XmlIncludeAttribute": Include(attribute, id); break;
				default: throw new InvalidDataException($"{id}: unsupported type attribute {attribute.Type}");
			}
		}
		PlainName(root);
		PlainName(name);
		return (root, name, ns);
	}
	private static void Settings(AttributeRecord attribute, string[] allowed, string path)
	{
		foreach (var (key, argument) in attribute.NamedArguments)
		{
			var value = Unwrap(argument);
			if (!allowed.Contains(key) || !(key == "IsNullable" ? value is false : value is string || key == "Namespace" && value is null))
				throw new InvalidDataException($"{path}: unsupported {attribute.Type}.{key}={value}");
		}
	}
	public static string Include(AttributeRecord attribute, string path)
	{
		Settings(attribute, [], path);
		if (attribute.ConstructorArguments.Count != 1 || attribute.ConstructorArguments[0].Type != "System.Type" || Unwrap(attribute.ConstructorArguments[0]) is not string id)
			throw new InvalidDataException($"{path}: XmlInclude requires one System.Type argument");
		return id;
	}
	public string? SequenceItem(TypeRecord type)
	{
		if (type.Kind != "collection" || type.CustomXml) return null;
		var list = type.GenericDefinition == "System.Collections.Generic.List`1";
		if (!list && !type.Id.EndsWith("[]", StringComparison.Ordinal)) return null;
		if (type.ElementType is null || list && (type.GenericArguments.Count != 1 || type.GenericArguments[0] != type.ElementType) || type.Attributes.Count != 0)
			throw new InvalidDataException($"{type.Id}: invalid array/list metadata");
		return type.ElementType;
	}
	public string ItemName(string id, bool root = false, HashSet<string>? active = null)
	{
		active ??= [];
		if (!active.Add(id))
			throw new InvalidDataException($"{id}: recursive array/nullable naming metadata");
		try
		{
			var type = Types.GetValueOrDefault(id);
			if (type is not null && SequenceItem(type) is { } item)
			{
				var name = ItemName(item, false, active);
				return "ArrayOf" + char.ToUpperInvariant(name[0]) + name[1..];
			}
			if (type?.Kind == "nullable")
			{
				if (type.GenericDefinition != "System.Nullable`1" || type.GenericArguments.Count != 1)
					throw new InvalidDataException($"{id}: incomplete nullable metadata");
				return ItemName(type.GenericArguments[0], root, active);
			}
			if (Scalars.TryGetValue(id, out var scalar)) return scalar;
			var names = Names(id);
			return root ? names.Root : names.Type;
		}
		finally { active.Remove(id); }
	}
	public bool Assignable(string candidate, string declared)
	{
		var seen = new HashSet<string>();
		for (string? current = candidate; current is not null && seen.Add(current); current = Types.GetValueOrDefault(current)?.BaseType)
			if (current == declared || declared == "System.Object") return true;
		return false;
	}
}
