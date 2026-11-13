using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;

internal static class CatalogExtractor
{
	private const string XmlNamespace = "System.Xml.Serialization.";
	// Constructed FullName embeds assembly versions for every generic argument.
	// Use recursive CLR names so references stay short and independent of runtime version.
	private static string Id(Type type)
	{
		if (type.IsArray) return Id(type.GetElementType()!) + "[" + new string(',', type.GetArrayRank() - 1) + "]";
		if (type.IsGenericType)
			return type.GetGenericTypeDefinition().FullName + "[" + string.Join(",", type.GetGenericArguments().Select(Id)) + "]";
		return type.FullName ?? type.Name;
	}

	public static Catalog Extract(string gamePath, string[] roots)
	{
		// Prefer the game's framework dependencies. The host runtime fills gaps
		// for installations which don't bundle framework assemblies.
		var paths = Directory.GetFiles(gamePath, "*.dll")
			.Concat(Directory.GetFiles(RuntimeEnvironment.GetRuntimeDirectory(), "*.dll"))
			.DistinctBy(Path.GetFileName, StringComparer.OrdinalIgnoreCase);
		using var context = new MetadataLoadContext(new PathAssemblyResolver(paths));
		var assembly = context.LoadFromAssemblyPath(Path.Combine(gamePath, "Stardew Valley.dll"));
		var diagnostics = new List<string>();
		var queue = new Queue<Type>();
		var seen = new HashSet<string>(StringComparer.Ordinal);
		var records = new List<TypeRecord>();
		foreach (var root in roots) queue.Enqueue(assembly.GetType(root, true)!);

		while (queue.TryDequeue(out var type))
		{
			var id = Id(type);
			if (!seen.Add(id)) continue;
			try
			{
				var customXml = type.GetInterfaces().Any(i => Id(i) == "System.Xml.Serialization.IXmlSerializable");
				var element = Element(type);
				var kind = Kind(type, element);
				var attributes = Attributes(type);
				var members = new List<MemberRecord>();

				// Only explicit XML type declarations introduce polymorphic types.
				// In particular, System.Object must not pull in every game subclass.
				var declaredTypes = AttributeTypes(type.GetCustomAttributesData()).DistinctBy(Id).ToArray();
				foreach (var declared in declaredTypes) queue.Enqueue(declared);
				var children = declaredTypes.Where(t => t != type && type.IsAssignableFrom(t)).Select(Id).Order(StringComparer.Ordinal).ToList();

				// These reviewed implementations need their generic payload declarations:
				// dictionaries delegate key/value serialization, while NetNullableEnum
				// writes strings whose valid names come from its enum argument. Arbitrary
				// custom serializers still do not expose a generic XML contract.
				// The case-insensitive subclass fixes string keys and declares only TValue.
				var genericDefinition = type.IsGenericType ? type.GetGenericTypeDefinition().FullName : null;
				var genericArguments = type.IsGenericType ? type.GetGenericArguments() : [];
				if (genericDefinition is "StardewValley.SerializableDictionary`2"
					or "StardewValley.SerializableDictionaryWithCaseInsensitiveKeys`1"
					or "Netcode.NetNullableEnum`1")
					foreach (var argument in genericArguments) queue.Enqueue(argument);

				// Inventory delegates each slot, including null slots, to the Item
				// serializer. Follow that reviewed payload without exposing runtime members.
				if (type.FullName == "StardewValley.Inventories.Inventory" && element is not null)
					queue.Enqueue(element);

				// Custom serializers own their XML. CLR properties and generic
				// parameters aren't evidence of their saved representation.
				if (!customXml)
				{
					if (kind == "collection" && element is not null) queue.Enqueue(element);
					if (kind == "nullable") queue.Enqueue(type.GetGenericArguments()[0]);
					if (kind == "object" && type.BaseType is { } parent && parent.FullName != "System.Object") queue.Enqueue(parent);

					// Scalars and collection implementations are terminal records.
					// Object members include inherited declarations, so their saved
					// fields remain available without exploring runtime machinery.
					if (kind is "object" or "enum")
					{
						var flags = BindingFlags.Public | (kind == "enum" ? BindingFlags.Static : BindingFlags.Instance);
						foreach (var member in type.GetMembers(flags)
							.Where(m => m is FieldInfo || m is PropertyInfo p && p.GetIndexParameters().Length == 0)
							.OrderBy(m => m.Name, StringComparer.Ordinal))
						{
							var field = member as FieldInfo;
							var property = member as PropertyInfo;
							var memberType = field?.FieldType ?? property!.PropertyType;
							var memberAttributes = Attributes(member);
							if (memberAttributes.Any(a => a.Type == XmlNamespace + "XmlIgnoreAttribute")) continue;

							// Unannotated readonly scalars aren't ordinary serializer
							// members. Preserve explicit XML declarations regardless:
							// the game serializes annotated readonly Netcode fields.
							// Readonly collection fields and getter-only collections
							// can also be populated in place; keep both forms.
							var readable = field is not null || property!.GetMethod?.IsPublic == true;
							var writable = field is not null ? !field.IsInitOnly && !field.IsLiteral : property!.SetMethod?.IsPublic == true;
							var explicitXml = memberAttributes.Any(a => a.Type.StartsWith(XmlNamespace, StringComparison.Ordinal));
							if (kind != "enum" && !explicitXml && (!readable || !writable && Element(memberType) is null)) continue;
							// Accessor details are inspection inputs, not catalog fields.
							// Only readable members enter the saved-value contract.
							if (!readable) continue;
							members.Add(new(member.Name, Id(memberType), memberAttributes));
							if (kind != "enum") queue.Enqueue(memberType);
							EnqueueAttributeTypes(member.GetCustomAttributesData(), queue);
						}
					}
				}
				EnqueueAttributeTypes(type.GetCustomAttributesData(), queue);
				records.Add(new(id, type.Assembly.GetName().Name!, kind,
					type.BaseType is null ? null : Id(type.BaseType), element is null ? null : Id(element), MaxItems(type),
					customXml, type.IsAbstract, genericDefinition, genericArguments.Select(Id).ToList(), children, attributes, members));
			}
			catch (Exception error) when (error is FileNotFoundException or TypeLoadException or NotSupportedException)
			{
				// A partial catalog remains inspectable, but a nonzero command
				// exit code prevents automation from treating it as complete.
				diagnostics.Add($"{id}: {error.Message}");
			}
		}

		// Hash only assemblies actually loaded from the game directory. This
		// records inspected dependencies without copying proprietary binaries.
		var assemblies = context.GetAssemblies().Where(a => Path.GetDirectoryName(a.Location) == gamePath)
			.OrderBy(a => a.GetName().Name, StringComparer.Ordinal)
			.Select(a => new AssemblyRecord(a.GetName().Name!, a.GetName().Version?.ToString() ?? "unknown",
				Path.GetFileName(a.Location), Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(a.Location))).ToLowerInvariant()))
			.ToList();
		string? AssemblyAttribute(string name) => assembly.GetCustomAttributesData()
			.FirstOrDefault(a => a.AttributeType.FullName == "System.Reflection." + name)?.ConstructorArguments[0].Value?.ToString();
		var framework = assembly.GetCustomAttributesData().FirstOrDefault(a =>
			a.AttributeType.FullName == "System.Runtime.Versioning.TargetFrameworkAttribute")?.ConstructorArguments[0].Value?.ToString();
		return new(3, typeof(CatalogExtractor).Assembly.GetName().Version!.ToString(),
			AssemblyAttribute("AssemblyInformationalVersionAttribute")?.Split(",")[0], assembly.GetName().Version!.ToString(), framework,
			roots.Distinct().Order(StringComparer.Ordinal).ToList(), assemblies,
			records.OrderBy(t => t.Id, StringComparer.Ordinal).ToList(), diagnostics.Order(StringComparer.Ordinal).ToList());
	}

	private static int? MaxItems(Type type)
	{
		// NetEnum has its own string enumerator over one enum value rather than
		// deriving from NetField<T>. It has the same single-value XML contract.
		if (type.IsGenericType && type.GetGenericTypeDefinition().FullName == "Netcode.NetEnum`1")
			return 1;
		// NetField exposes a single value through IEnumerable for XmlSerializer.
		// Its Add method rejects a second value; this includes inherited NetRef
		// implementations, without restricting ordinary NetCollection instances.
		for (Type? current = type; current is not null; current = current.BaseType)
			if (current.IsGenericType && current.GetGenericTypeDefinition().FullName == "Netcode.NetField`2")
				return 1;
		return null;
	}

	private static Type? Element(Type type)
	{
		if (type.IsArray) return type.GetElementType();
		// NetNullableEnum hides NetField<T?>'s enumerator with a string enumerator
		// and Add(string). Its XML items are enum-name text, not Nullable<T> nodes.
		// Reflect the reviewed public enumerator rather than choosing an arbitrary
		// IEnumerable interface when the type implements both forms.
		if (type.IsGenericType && type.GetGenericTypeDefinition().FullName == "Netcode.NetNullableEnum`1")
			return type.GetMethod("GetEnumerator", BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)!
			 .ReturnType.GetGenericArguments()[0];

		if (type.FullName == "System.String") return null;
		var enumerable = type.GetInterfaces().Append(type).FirstOrDefault(i =>
			i.IsGenericType && i.GetGenericTypeDefinition().FullName == "System.Collections.Generic.IEnumerable`1");
		return enumerable?.GetGenericArguments()[0];
	}

	private static string Kind(Type type, Type? element)
	{
		if (type.IsEnum) return "enum";
		if (type.IsPrimitive || type.FullName is "System.String" or "System.Decimal" or "System.DateTime" or "System.Guid" or "System.TimeSpan") return "scalar";
		if (type.IsGenericType && type.GetGenericTypeDefinition().FullName == "System.Nullable`1") return "nullable";
		if (element is not null) return "collection";
		return "object";
	}

	private static List<AttributeRecord> Attributes(MemberInfo member) => member.GetCustomAttributesData()
		.Where(a => a.AttributeType.FullName?.StartsWith(XmlNamespace, StringComparison.Ordinal) == true
			|| a.AttributeType.FullName == "System.ComponentModel.DefaultValueAttribute")
		.Select(a => new AttributeRecord(a.AttributeType.FullName!, a.ConstructorArguments.Select(Value).ToList(),
			new SortedDictionary<string, AttributeValue>(a.NamedArguments.ToDictionary(n => n.MemberName, n => Value(n.TypedValue)), StringComparer.Ordinal)))
		.ToList();

	private static AttributeValue Value(CustomAttributeTypedArgument argument)
	{
		// Type references and arrays can't be serialized as runtime reflection
		// objects. Enum values retain their declared type and numeric encoding.
		object? value = argument.Value switch
		{
			Type type => Id(type),
			ICollection<CustomAttributeTypedArgument> items => items.Select(Value).ToList(),
			_ => argument.Value
		};
		return new(Id(argument.ArgumentType), value);
	}

	// Type arguments in XmlInclude/XmlElement/XmlArrayItem carry the explicit
	// polymorphic contract. Traverse those declarations without scanning subclasses.
	private static IEnumerable<Type> AttributeTypes(IList<CustomAttributeData> attributes) =>
		attributes.Where(a => a.AttributeType.Namespace == "System.Xml.Serialization")
			.SelectMany(a => a.ConstructorArguments.Concat(a.NamedArguments.Select(n => n.TypedValue)))
			.Select(value => value.Value).OfType<Type>();

	private static void EnqueueAttributeTypes(IList<CustomAttributeData> attributes, Queue<Type> queue)
	{
		foreach (var type in AttributeTypes(attributes)) queue.Enqueue(type);
	}
}
