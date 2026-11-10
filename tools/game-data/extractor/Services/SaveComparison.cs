using System.Text.Json;
using System.Xml;
using System.Xml.Linq;

public sealed record ComparisonFile(string File, int MatchedElements, List<string> Issues, List<string> Unchecked);
public sealed record ComparisonReport(string Scope, List<string> CatalogDiagnostics, List<ComparisonFile> Files);

internal sealed class SaveComparison
{
	private const string Xml = "System.Xml.Serialization.";
	private readonly Dictionary<string, TypeRecord> types;
	private readonly ComparisonFile report;
	private int matched;

	private SaveComparison(Catalog catalog, string file)
	{
		types = catalog.Types.ToDictionary(t => t.Id);
		report = new(file, 0, [], []);
	}

	public static ComparisonReport Compare(Catalog catalog, string[] inputs)
	{
		// Directory inputs inspect XML-looking files only, because actual saves
		// have no extension. Explicit files always report malformed XML as errors.
		var files = new SortedSet<string>(StringComparer.Ordinal);
		foreach (var input in inputs)
		{
			var path = Path.GetFullPath(input);
			if (File.Exists(path)) files.Add(path);
			else if (Directory.Exists(path))
			{
				foreach (var file in Directory.EnumerateFiles(path, "*", SearchOption.AllDirectories))
				{
					using var reader = new StreamReader(file);
					int first;
					do { first = reader.Read(); } while (first >= 0 && char.IsWhiteSpace((char)first));
					if (first == '<') files.Add(file);
				}
			}
			else throw new FileNotFoundException($"Save input not found: {path}");
		}
		if (files.Count == 0) throw new InvalidDataException("No XML save files found.");
		var reports = new List<ComparisonFile>();
		foreach (var file in files)
		{
			var comparison = new SaveComparison(catalog, file);
			try
			{
				// Saves must not resolve external entities or read local/network resources.
				using var reader = XmlReader.Create(file, new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null });
				var root = XDocument.Load(reader).Root ?? throw new InvalidDataException("Missing XML root.");
				var candidates = catalog.Roots.Select(id => comparison.types[id]).Where(t => RootName(t) == root.Name).ToArray();
				if (candidates.Length != 1) comparison.report.Issues.Add($"/{root.Name}: expected one matching catalog root, found {candidates.Length}.");
				else comparison.Visit(root, candidates[0].Id, "/" + root.Name.LocalName, 0);
			}
			catch (Exception error) when (error is XmlException or InvalidDataException)
			{
				comparison.report.Issues.Add(error.Message);
			}
			reports.Add(comparison.report with { MatchedElements = comparison.matched });
		}
		return new("Observed element/attribute coverage only; does not validate scalar values, required fields, ordering, or serializer defaults in full.", catalog.Diagnostics, reports);
	}

	private void Visit(XElement element, string typeId, string path, int depth)
	{
		// Bound traversal independently of save size; recursive types are valid,
		// but pathological XML must not overflow the process stack.
		if (depth > 128) { report.Unchecked.Add($"{path}: depth limit reached."); return; }
		if (!types.TryGetValue(typeId, out var type)) { report.Unchecked.Add($"{path}: missing type {typeId}."); return; }
		matched++;
		var xsiType = element.Attribute(XName.Get("type", "http://www.w3.org/2001/XMLSchema-instance"));
		if (xsiType is not null)
		{
			// xsi:type uses namespace-qualified XML type names, not CLR names.
			var parts = xsiType.Value.Split(':');
			var ns = parts.Length == 2 ? element.GetNamespaceOfPrefix(parts[0]) : element.GetDefaultNamespace();
			if (ns is null) { report.Issues.Add($"{path}: unbound xsi:type prefix."); return; }
			var name = XName.Get(parts[^1], ns.NamespaceName);
			var choices = types.Values.Where(t => TypeName(t) == name && IsDerivedFrom(t, typeId)).ToArray();
			if (choices.Length != 1) { report.Unchecked.Add($"{path}: unresolved xsi:type {xsiType.Value}."); return; }
			type = choices[0];
		}
		if (type.CustomXml) { report.Unchecked.Add($"{path}: {type.Id} implements IXmlSerializable."); return; }
		if (element.Attribute(XName.Get("nil", "http://www.w3.org/2001/XMLSchema-instance")) is { } nil && nil.Value is "true" or "1")
		{ report.Unchecked.Add($"{path}: xsi:nil nullability is not checked."); return; }
		if (type.Kind is "scalar" or "enum")
		{
			if (element.HasElements) report.Issues.Add($"{path}: scalar contains child elements.");
			return;
		}
		if (type.Kind == "nullable") { report.Unchecked.Add($"{path}: nullable value mapping."); return; }
		if (type.Kind == "collection")
		{
			VisitItems(element, type.ElementType, [], path, depth);
			return;
		}

		// Inspection already excludes unreadable and ignored members. The
		// catalog describes saved values rather than C# accessors/declarations.
		var members = type.Members;
		foreach (var attribute in element.Attributes().Where(a => !a.IsNamespaceDeclaration && a.Name.NamespaceName != "http://www.w3.org/2001/XMLSchema-instance"))
		{
			var known = members.Any(m => m.Attributes.Where(a => a.Type == Xml + "XmlAttributeAttribute")
				.Any(a => Name(a, "AttributeName", m.Name, "") == attribute.Name));
			if (!known && !members.Any(m => Has(m.Attributes, "XmlAnyAttributeAttribute"))) report.Issues.Add($"{path}/@{attribute.Name}: unknown attribute.");
		}
		foreach (var child in element.Elements())
		{
			var childPath = path + "/" + child.Name.LocalName;
			var mappings = new List<(MemberRecord Member, AttributeRecord? Attribute)>();
			foreach (var member in members)
			{
				if (Has(member.Attributes, "XmlAttributeAttribute") || Has(member.Attributes, "XmlTextAttribute")) continue;
				var explicitElements = member.Attributes.Where(a => a.Type == Xml + "XmlElementAttribute").ToArray();
				if (explicitElements.Length != 0)
				{
					foreach (var attr in explicitElements)
						if (Name(attr, "ElementName", member.Name, element.Name.NamespaceName) == child.Name) mappings.Add((member, attr));
				}
				else
				{
					var wrapper = member.Attributes.FirstOrDefault(a => a.Type == Xml + "XmlArrayAttribute");
					if (Name(wrapper, "ElementName", member.Name, element.Name.NamespaceName) == child.Name) mappings.Add((member, wrapper));
				}
			}
			if (mappings.Count != 1)
			{
				if (members.Any(m => Has(m.Attributes, "XmlAnyElementAttribute"))) report.Unchecked.Add($"{childPath}: wildcard element.");
				else report.Issues.Add($"{childPath}: expected one member mapping, found {mappings.Count}.");
				continue;
			}
			var (memberRecord, mapping) = mappings[0];
			var target = TypeArgument(mapping) ?? memberRecord.Type;
			if (types.TryGetValue(memberRecord.Type, out var collection) && collection.Kind == "collection")
			{
				if (mapping?.Type == Xml + "XmlElementAttribute") Visit(child, TypeArgument(mapping) ?? collection.ElementType!, childPath, depth + 1);
				else VisitItems(child, collection.ElementType, memberRecord.Attributes.Where(a => a.Type == Xml + "XmlArrayItemAttribute").ToArray(), childPath, depth + 1);
			}
			else Visit(child, target, childPath, depth + 1);
		}
	}

	private void VisitItems(XElement wrapper, string? itemType, AttributeRecord[] attributes, string path, int depth)
	{
		foreach (var item in wrapper.Elements())
		{
			var itemPath = path + "/" + item.Name.LocalName;
			if (itemType is null) { report.Unchecked.Add($"{itemPath}: collection item type missing."); continue; }
			// Constructed generic collection names depend on serializer naming rules;
			// CLR assembly-qualified argument names are not XML local names.
			if (attributes.Length == 0 && itemType.Contains('`'))
			{ report.Unchecked.Add($"{itemPath}: generic collection item naming for {itemType}."); continue; }
			if (attributes.Any(a => Named(a, "NestingLevel") is { } level && level != "0"))
			{ report.Unchecked.Add($"{itemPath}: nested XmlArrayItem mapping."); continue; }
			var matches = attributes.Where(a => Name(a, "ElementName", DefaultItemName(TypeArgument(a) ?? itemType), wrapper.Name.NamespaceName) == item.Name).ToArray();
			if (attributes.Length > 0 && matches.Length != 1) { report.Issues.Add($"{itemPath}: unknown or ambiguous collection item."); continue; }
			if (attributes.Length == 0 && XName.Get(DefaultItemName(itemType), wrapper.Name.NamespaceName) != item.Name)
			{ report.Unchecked.Add($"{itemPath}: collection naming requires serializer rules for {itemType}."); continue; }
			Visit(item, matches.Length == 1 ? TypeArgument(matches[0]) ?? itemType : itemType, itemPath, depth + 1);
		}
	}

	private bool IsDerivedFrom(TypeRecord type, string expected)
	{
		var seen = new HashSet<string>();
		while (seen.Add(type.Id))
		{
			if (type.Id == expected) return true;
			if (type.BaseType is null || !types.TryGetValue(type.BaseType, out type!)) return false;
		}
		return false;
	}

	private static bool Has(List<AttributeRecord> attributes, string name) => attributes.Any(a => a.Type == Xml + name);
	private static string? Text(AttributeValue? value) => value?.Value is JsonElement element ? element.ValueKind == JsonValueKind.Null ? null : element.ToString() : value?.Value?.ToString();
	private static string? Named(AttributeRecord? attribute, string name) => attribute is null ? null : Text(attribute.NamedArguments.GetValueOrDefault(name));
	private static string? TypeArgument(AttributeRecord? attribute) => Named(attribute, "Type") ?? Text(attribute?.ConstructorArguments.FirstOrDefault(a => a.Type == "System.Type"));
	private static XName Name(AttributeRecord? attribute, string setting, string fallback, string defaultNamespace)
	{
		// Constructor string arguments specify names; an omitted/empty name uses
		// the member/type name. Form=Unqualified (2) suppresses namespace inheritance.
		var name = Named(attribute, setting) ?? Text(attribute?.ConstructorArguments.FirstOrDefault(a => a.Type == "System.String"));
		var ns = Named(attribute, "Namespace") ?? (Named(attribute, "Form") == "2" ? "" : defaultNamespace);
		return XName.Get(string.IsNullOrEmpty(name) ? XmlConvert.EncodeLocalName(fallback) : name, ns);
	}
	private static XName RootName(TypeRecord type) => Name(type.Attributes.FirstOrDefault(a => a.Type == Xml + "XmlRootAttribute"), "ElementName", ClrName(type.Id), "");
	private static XName TypeName(TypeRecord type) => Name(type.Attributes.FirstOrDefault(a => a.Type == Xml + "XmlTypeAttribute"), "TypeName", ClrName(type.Id), "");
	private static string ClrName(string id) => id.Split('[')[0].Split('.', '+').Last().Split('`')[0];
	private static string DefaultItemName(string id) => id switch
	{
		"System.String" => "string",
		"System.Int32" => "int",
		"System.Int64" => "long",
		"System.Boolean" => "boolean",
		"System.Single" => "float",
		"System.Double" => "double",
		"System.Byte" => "unsignedByte",
		"System.Int16" => "short",
		"System.UInt32" => "unsignedInt",
		"System.UInt64" => "unsignedLong",
		"System.UInt16" => "unsignedShort",
		"System.Decimal" => "decimal",
		"System.DateTime" => "dateTime",
		_ => XmlConvert.EncodeLocalName(ClrName(id))
	};
}
