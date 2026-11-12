using System.Xml;
using System.Xml.Linq;

public sealed record CoverageFile(string File, int MatchedElements, List<string> Issues, List<string> Unchecked);
public sealed record CoverageReport(string Scope, List<string> CatalogDiagnostics, List<CoverageFile> Files);

internal sealed class SaveCoverage
{
	private static readonly XNamespace Xsi = "http://www.w3.org/2001/XMLSchema-instance";
	private readonly Dictionary<string, ObjectContract> objects;
	private readonly List<string> issues = [];
	private readonly List<string> uncheckedPaths = [];
	private int matched;
	private SaveCoverage(CompilationContract contract)
	{
		objects = contract.Objects.ToDictionary(o => o.Id);
	}

	public static CoverageReport Compare(Catalog catalog, string[] inputs)
	{
		// Use exactly the generator's effective contracts. Unsupported metadata is
		// visible as unchecked coverage, never reinterpreted by a second rule set.
		var contracts = new List<CompilationContract>();
		var unsupported = new List<string>();
		var roots = catalog.Roots is { Count: > 0 } ? catalog.Roots : catalog.Types.Where(t => t.Kind == "object").Take(1).Select(t => t.Id).ToList();
		foreach (var root in roots)
		{
			try { contracts.Add(new ContractResolver(catalog).Resolve(root)); }
			catch (InvalidDataException error) { unsupported.Add(error.Message); }
		}
		var files = new SortedSet<string>(StringComparer.Ordinal);
		foreach (var input in inputs)
		{
			var path = Path.GetFullPath(input);
			if (File.Exists(path)) files.Add(path);
			else if (Directory.Exists(path))
			{
				foreach (var file in Directory.EnumerateFiles(path, "*", SearchOption.AllDirectories))
				{
					using var text = new StreamReader(file);
					int first;
					do { first = text.Read(); } while (first >= 0 && char.IsWhiteSpace((char)first));
					if (first == '<') files.Add(file);
				}
			}
			else throw new FileNotFoundException($"Save input not found: {path}");
		}
		if (files.Count == 0) throw new InvalidDataException("No XML save files found.");
		var results = new List<CoverageFile>();
		foreach (var file in files)
		{
			var report = new CoverageFile(file, 0, [], [.. unsupported]);
			try
			{
				using var reader = XmlReader.Create(file, new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null });
				var root = XDocument.Load(reader).Root ?? throw new InvalidDataException("Missing XML root.");
				var candidates = contracts.Where(c => root.Name == XName.Get(c.Root.RootName)).ToArray();
				if (candidates.Length == 1)
				{
					var comparison = new SaveCoverage(candidates[0]);
					comparison.Visit(root, new("object", Type: candidates[0].Root.Id), "/" + root.Name.LocalName, 0);
					report = new(file, comparison.matched, comparison.issues, [.. unsupported, .. comparison.uncheckedPaths]);
				}
				else if (unsupported.Count == 0) report.Issues.Add($"/{root.Name}: expected one matching root, found {candidates.Length}.");
			}
			catch (Exception error) when (error is XmlException or InvalidDataException) { report.Issues.Add(error.Message); }
			results.Add(report);
		}
		return new("Effective-contract XML coverage; scalar values, required members and gameplay validity are not checked.", catalog.Diagnostics, results);
	}

	private void Visit(XElement element, ValueContract value, string path, int depth)
	{
		if (depth > 128) { uncheckedPaths.Add(path + ": depth limit reached"); return; }
		matched++;
		if (value.Kind == "nullable")
		{
			if (element.Attribute(Xsi + "nil")?.Value is "true" or "1")
			{
				if (element.HasElements || !string.IsNullOrWhiteSpace(element.Value)) issues.Add(path + ": nil element contains data");
				return;
			}
			Visit(element, value.Value!, path, depth + 1);
			return;
		}
		if (value.Kind is "scalar" or "enum")
		{
			if (element.HasElements) issues.Add(path + ": scalar contains elements");
			return;
		}
		if (value.Kind is "array" or "inventory")
		{
			Items(element, value.Kind == "inventory" ? "Item" : value.ItemName!, value.Kind == "inventory" ? new("nullable", Value: value.Item) : value.Item!, path, depth);
			return;
		}
		if (value.Kind == "dictionary")
		{
			foreach (var entry in element.Elements())
			{
				if (entry.Name != "item") { issues.Add(path + ": unknown dictionary entry " + entry.Name); continue; }
				foreach (var (name, payloadName, payload) in new[] { ("key", value.KeyName!, value.Key!), ("value", value.ValueName!, value.Value!) })
				{
					var wrappers = entry.Elements(name).ToArray();
					if (wrappers.Length != 1) { issues.Add(path + ": expected one " + name); continue; }
					var children = wrappers[0].Elements().ToArray();
					// Registered legacy string payloads are accepted by the runtime too.
					if (children.Length != 1 || children[0].Name != payloadName && !(payloadName == "string" && children[0].Name.LocalName is "int" or "LocationContext"))
					{ issues.Add(path + ": unexpected " + name + " payload"); continue; }
					Visit(children[0], payload, path + "/item/" + name, depth + 1);
				}
			}
			return;
		}
		var declared = objects[value.Type!];
		var actual = declared;
		if (element.Attribute(Xsi + "type") is { } type)
		{
			var parts = type.Value.Split(':');
			var ns = parts.Length == 1 ? element.GetDefaultNamespace() : parts.Length == 2 ? element.GetNamespaceOfPrefix(parts[0]) : null;
			if (ns is null) { issues.Add(path + ": invalid type QName"); return; }
			if (declared.Id == "System.Object" && Metadata.Scalars.Any(s => s.Value == parts[^1] && ns.NamespaceName == (s.Key == "System.Guid" ? "http://microsoft.com/wsdl/types/" : Metadata.Xsd)))
			{
				if (element.HasElements) issues.Add(path + ": scalar contains elements");
				return;
			}
			var candidates = declared.Variants.Select(id => objects[id]).Where(o => o.TypeName == parts[^1] && o.TypeNamespace == ns.NamespaceName).ToArray();
			if (candidates.Length != 1) { issues.Add(path + ": unknown or ambiguous type " + type.Value); return; }
			actual = candidates[0];
		}
		else if (actual.IsAbstract) { issues.Add(path + ": abstract value requires xsi:type"); return; }
		foreach (var attribute in element.Attributes().Where(a => !a.IsNamespaceDeclaration && a.Name.Namespace != Xsi))
			if (!actual.Fields.Any(f => f.Placement == "attribute" && attribute.Name == f.XmlName)) issues.Add(path + "/@" + attribute.Name + ": unknown attribute");
		foreach (var child in element.Elements())
		{
			var field = actual.Fields.SingleOrDefault(f => f.Placement != "attribute" && child.Name == f.XmlName);
			if (field is null) { issues.Add(path + "/" + child.Name + ": unknown element"); continue; }
			if (field.Placement == "collection") Items(child, field.ItemName!, field.Value, path + "/" + child.Name, depth + 1);
			else Visit(child, field.Value, path + "/" + child.Name, depth + 1);
		}
	}
	private void Items(XElement wrapper, string name, ValueContract value, string path, int depth)
	{
		foreach (var child in wrapper.Elements())
		{
			if (child.Name != name) issues.Add(path + "/" + child.Name + ": unknown collection item");
			else Visit(child, value, path + "/" + name, depth + 1);
		}
	}
}
