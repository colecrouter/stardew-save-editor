internal sealed class ContractResolver(Catalog catalog)
{
	private readonly Metadata metadata = new(catalog);
	private readonly Dictionary<string, ObjectContract> objects = new(StringComparer.Ordinal);
	private readonly HashSet<string> active = [];
	private readonly HashSet<string> known = [];

	public CompilationContract Resolve(string root)
	{
		// Discover the whole reachable graph before selecting variants. Includes on
		// one owner can authorize a subtype used by another owner later in traversal.
		var queue = new Queue<string>();
		var seen = new HashSet<string>();
		queue.Enqueue(root);
		while (queue.TryDequeue(out var id))
		{
			if (!seen.Add(id) || !metadata.Types.TryGetValue(id, out var type)) continue;
			if (type.Kind == "object" && !type.CustomXml) known.Add(id);
			foreach (var attribute in type.Attributes.Where(a => a.Type == Metadata.Xml + "XmlIncludeAttribute"))
			{
				var included = Metadata.Include(attribute, id);
				metadata.Require(included);
				known.Add(included);
				queue.Enqueue(included);
			}
			if (type.BaseType is { } parent) queue.Enqueue(parent);
			if (type.ElementType is { } item) queue.Enqueue(item);
			foreach (var argument in type.GenericArguments) queue.Enqueue(argument);
			foreach (var member in type.Members) queue.Enqueue(member.Type);
		}
		Visit(root);
		return new(objects[root], objects.Values.OrderBy(o => o.Id, StringComparer.Ordinal).ToList());
	}
	private void Visit(string id)
	{
		// Back edges retain the CLR ID in their value contract. Emission supplies
		// lazy references; recursively expanding an active type would never finish.
		if (objects.ContainsKey(id) || !active.Add(id)) return;
		var type = metadata.Require(id);
		if (type.Kind != "object" || type.CustomXml)
			throw new InvalidDataException($"{id}: expected an ordinary object");
		var names = metadata.Names(id);
		var variants = known.Append(id).Distinct()
			.Where(candidate => metadata.Types.TryGetValue(candidate, out var t)
				&& t.Kind == "object" && !t.IsAbstract && !t.CustomXml
				&& metadata.Assignable(candidate, id))
			.Order(StringComparer.Ordinal).ToList();
		if (variants.Count == 0)
			throw new InvalidDataException($"{id}: no known concrete variants");
		var members = new HashSet<string>();
		var slots = new HashSet<string>();
		var fields = new List<FieldContract>();
		foreach (var member in type.Members.OrderBy(m => m.Name, StringComparer.Ordinal))
		{
			if (!members.Add(member.Name))
				throw new InvalidDataException($"{id}.{member.Name}: duplicate member");
			var field = Field(member, id + "." + member.Name);
			if (member.Name == "$type" || field.XmlName == "$type")
				throw new InvalidDataException($"{id}: $type is reserved for polymorphism");
			if (!slots.Add((field.Placement == "attribute" ? "@" : "") + field.XmlName))
				throw new InvalidDataException($"{id}.{member.Name}: duplicate XML mapping");
			fields.Add(field);
		}
		foreach (var variant in variants)
			if (variant != id) Visit(variant);
		// Concrete objects and boxed scalars share a QName space under System.Object.
		// Reject collisions during compilation instead of guessing at runtime.
		var qnames = new HashSet<(string, string)>();
		if (id == "System.Object")
			foreach (var (scalar, name) in Metadata.Scalars) qnames.Add((scalar == "System.Guid" ? "http://microsoft.com/wsdl/types/" : Metadata.Xsd, name));
		foreach (var variant in variants)
		{
			var identity = metadata.Names(variant);
			if (!qnames.Add((identity.Namespace, identity.Type)))
				throw new InvalidDataException($"{id}: ambiguous XML type {identity.Type}");
		}
		objects.Add(id, new(id, names.Root, names.Type, names.Namespace, type.IsAbstract, variants, fields));
		active.Remove(id);
	}
	private static void Validate(AttributeRecord attribute, string path)
	{
		if (attribute.Type is not (Metadata.Xml + "XmlElementAttribute" or Metadata.Xml + "XmlAttributeAttribute" or Metadata.Xml + "XmlArrayAttribute" or Metadata.Xml + "XmlArrayItemAttribute" or Metadata.Xml + "XmlEnumAttribute"))
			throw new InvalidDataException($"{path}: unsupported attribute {attribute.Type}");
		foreach (var (key, argument) in attribute.NamedArguments)
		{
			var value = Metadata.Unwrap(argument);
			// These are the reviewed defaults/overrides supported by the runtime.
			// A new annotation must gain an explicit representation, not be ignored.
			if (key == "Namespace" && (value is null || value is "")) continue;
			if (key == "Form" && value is long form && (form == 0 || form == 2)) continue;
			if (key == "IsNullable" && value is false) continue;
			if (key == "NestingLevel" && value is long level && level == 0) continue;
			if (key is "ElementName" or "AttributeName" or "TypeName" or "Name" && value is string) continue;
			throw new InvalidDataException($"{path}: unsupported {attribute.Type}.{key}={value}");
		}
		if (attribute.ConstructorArguments.Any(a => a.Type == "System.Type"))
			throw new InvalidDataException($"{path}: explicit item/element type overrides are unsupported");
	}
	private FieldContract Field(MemberRecord member, string path)
	{
		foreach (var attr in member.Attributes) Validate(attr, path);
		// Item annotations configure children inside a wrapper; they are not an
		// additional mapping for the member itself. Repeated siblings have no wrapper.
		var outer = member.Attributes.Where(a => a.Type != Metadata.Xml + "XmlArrayItemAttribute").ToArray();
		if (outer.Length > 1)
			throw new InvalidDataException($"{path}: multiple XML mappings are unsupported");
		var mapping = outer.FirstOrDefault();
		var attribute = mapping?.Type == Metadata.Xml + "XmlAttributeAttribute";
		var name = Metadata.Name(mapping, attribute ? "AttributeName" : "ElementName", member.Name);
		Metadata.PlainName(name);
		var record = metadata.Types.GetValueOrDefault(member.Type);
		if (member.Type == "System.Byte[]" || System.Text.RegularExpressions.Regex.IsMatch(member.Type, @"\[[,]+\]$"))
			throw new InvalidDataException($"{path}: binary/multidimensional arrays are unsupported");
		if (record?.Kind == "collection" && !record.CustomXml)
		{
			if (attribute)
				throw new InvalidDataException($"{path}: collection cannot be an attribute");
			var items = member.Attributes.Where(a => a.Type == Metadata.Xml + "XmlArrayItemAttribute").ToArray();
			if (items.Length > 1 || record.ElementType is null)
				throw new InvalidDataException($"{path}: ambiguous collection item mapping");
			ValueContract value;
			if (record.GenericDefinition == "Netcode.NetNullableEnum`1")
			{
				// This reviewed wrapper writes Enum.ToString labels, bypassing XmlEnum
				// aliases. An empty item means null; absence means zero items.
				if (record.ElementType != "System.String" || record.GenericArguments.Count != 1)
					throw new InvalidDataException($"{path}: invalid nullable enum metadata");
				value = Value(record.GenericArguments[0], path, true);
				if (value.Kind != "enum")
					throw new InvalidDataException($"{path}: nullable enum wrapper requires an enum");
				value = value with { NullableText = true };
			}
			else value = Value(record.ElementType, path);
			if (mapping?.Type == Metadata.Xml + "XmlElementAttribute")
			{
				if (items.Length != 0)
					throw new InvalidDataException($"{path}: XmlArrayItem requires a wrapped collection");
				return new(member.Name, name, "repeated", value, MaxItems: record.MaxItems);
			}
			var itemName = Metadata.Name(items.FirstOrDefault(), "ElementName", metadata.ItemName(record.ElementType));
			Metadata.PlainName(itemName);
			value = CollectionItem(record.ElementType, value, Metadata.Named(items.FirstOrDefault(), "IsNullable") is not false);
			return new(member.Name, name, "collection", value, itemName, record.MaxItems);
		}
		if (member.Attributes.Any(a => a.Type is Metadata.Xml + "XmlArrayAttribute" or Metadata.Xml + "XmlArrayItemAttribute"))
			throw new InvalidDataException($"{path}: array annotation on non-collection");
		var result = Value(member.Type, path);
		if (attribute && result.Kind is not ("scalar" or "enum"))
			throw new InvalidDataException($"{path}: element values cannot be XML attributes");
		return new(member.Name, name, attribute ? "attribute" : "element", result);
	}
	private ValueContract CollectionItem(string id, ValueContract value, bool allowNil = true)
	{
		// Wrapped reference items carry null slots; direct XmlElement repetitions
		// have a different default. CLR value types never acquire implicit nulls.
		var reference = id == "System.String" || value.Kind is "array" or "dictionary" or "inventory" || value.Kind == "object" && metadata.Types.GetValueOrDefault(id)?.BaseType != "System.ValueType";
		return allowNil && value.Kind != "nullable" && reference ? new("nullable", Value: value) : value;
	}
	private ValueContract Value(string id, string path, bool clrEnum = false, HashSet<string>? sequences = null)
	{
		// Built-ins are terminal, even when no separate record is present in a
		// hand-authored test catalog. Every other value needs inspected metadata.
		if (Metadata.Scalars.ContainsKey(id)) return new("scalar", Type: id);
		var type = metadata.Require(id);
		if (type.Kind == "nullable")
		{
			if (type.GenericDefinition != "System.Nullable`1" || type.GenericArguments.Count != 1 || type.GenericArguments[0] == id || metadata.Types.GetValueOrDefault(type.GenericArguments[0])?.Kind == "nullable")
				throw new InvalidDataException($"{path}: invalid nullable metadata");
			var inner = Value(type.GenericArguments[0], path);
			if (inner.Kind is not ("scalar" or "enum"))
				throw new InvalidDataException($"{path}: nullable requires scalar or enum");
			return new("nullable", Value: inner);
		}
		if (metadata.SequenceItem(type) is { } item)
		{
			sequences = sequences is null ? [] : new(sequences);
			if (!sequences.Add(id) || id == "System.Byte[]")
				throw new InvalidDataException($"{path}: recursive/binary array metadata is unsupported");
			return new("array", Item: CollectionItem(item, Value(item, path + "[]", sequences: sequences)), ItemName: metadata.ItemName(item));
		}
		if (type.CustomXml)
		{
			// Enumerable custom serializers do not use ordinary collection XML.
			// Only reviewed payload layouts may cross this boundary.
			if (id == "StardewValley.Inventories.Inventory")
			{
				if (type.ElementType != "StardewValley.Item")
					throw new InvalidDataException($"{path}: invalid inventory payload");
				return new("inventory", Item: Value(type.ElementType, path + ".slots"));
			}
			var insensitive = type.GenericDefinition == "StardewValley.SerializableDictionaryWithCaseInsensitiveKeys`1";
			if (insensitive || type.GenericDefinition == "StardewValley.SerializableDictionary`2")
			{
				if (type.GenericArguments.Count != (insensitive ? 1 : 2))
					throw new InvalidDataException($"{path}: invalid dictionary generic metadata");
				var keyId = insensitive ? "System.String" : type.GenericArguments[0];
				var valueId = type.GenericArguments[^1];
				var key = Value(keyId, path + ".key");
				string? identity = insensitive ? "ordinalIgnoreCase" : null;
				if (key.Kind == "object")
				{
					// Equality is implemented by the runtime's reviewed comparer, not by
					// arbitrary XML/object equality. Ensure its expected fields still exist.
					var fields = keyId switch
					{
						"StardewValley.FarmerPair" => new[] { ("Farmer1", "System.Int64"), ("Farmer2", "System.Int64") },
						"Microsoft.Xna.Framework.Vector2" => [("X", "System.Single"), ("Y", "System.Single")],
						_ => throw new InvalidDataException($"{path}: dictionary object key requires a registered identity: {keyId}")
					};
					var keyType = metadata.Require(keyId);
					if (keyType.BaseType != "System.ValueType" || keyType.IsAbstract || keyType.Members.Count != fields.Length || fields.Any(f => !keyType.Members.Any(m => m.Name == f.Item1 && m.Type == f.Item2)))
						throw new InvalidDataException($"{path}: registered key identity no longer matches {keyId}");
					identity = keyId;
				}
				else if (key.Kind is not ("scalar" or "enum")) throw new InvalidDataException($"{path}: unsupported dictionary key");
				return new("dictionary", Key: key, Value: Value(valueId, path + ".value"), KeyName: metadata.ItemName(keyId, true), ValueName: metadata.ItemName(valueId, true), KeyIdentity: identity);
			}
			throw new InvalidDataException($"{path}: unsupported custom XML serializer {id}");
		}
		if (type.Kind == "object")
		{
			Visit(id);
			return new("object", Type: id);
		}
		if (type.Kind != "enum" || type.Attributes.Count != 0)
			throw new InvalidDataException($"{path}: unsupported value type {id}");
		var labels = new List<string>();
		foreach (var member in type.Members)
		{
			if (member.Attributes.Count > 1 || member.Attributes.Any(a => a.Type != Metadata.Xml + "XmlEnumAttribute"))
				throw new InvalidDataException($"{path}: unsupported enum annotations");
			foreach (var a in member.Attributes) Validate(a, path);
			labels.Add(clrEnum ? member.Name : Metadata.Name(member.Attributes.FirstOrDefault(), "Name", member.Name));
		}
		if (labels.Count == 0 || labels.Distinct().Count() != labels.Count)
			throw new InvalidDataException($"{path}: empty or ambiguous enum");
		return new("enum", Type: id, Labels: labels);
	}
}
