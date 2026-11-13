using System.Text.Json;
using System.Text.Encodings.Web;
using System.Text.Json.Serialization;
using System.Text.Json.Serialization.Metadata;
using System.Collections;

internal static class Cli
{
	public static readonly JsonSerializerOptions Json = new()
	{
		PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
		// These are standalone JSON documents, not HTML script fragments. Keep
		// CLR backticks and names readable instead of escaping them as Unicode.
		Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
		WriteIndented = true,
		IndentCharacter = '\t',
		IndentSize = 1,
		TypeInfoResolver = CatalogResolver(),
		Converters = { new JsonStringEnumConverter() }
	};

	private static DefaultJsonTypeInfoResolver CatalogResolver()
	{
		var resolver = new DefaultJsonTypeInfoResolver();
		resolver.Modifiers.Add(info =>
		{
			// Compact metadata only: report arrays and explicit attribute nulls
			// stay present. Omitted lists/bools restore their documented defaults.
			if (info.Type != typeof(TypeRecord) && info.Type != typeof(MemberRecord) && info.Type != typeof(AttributeRecord)) return;
			foreach (var property in info.Properties)
				property.ShouldSerialize = (_, value) => value switch
				{
					null => false,
					bool flag => flag,
					ICollection collection => collection.Count != 0,
					_ => true
				};
		});
		return resolver;
	}

	// Expected operational errors are concise by default; verbose mode retains
	// the stack and loader details needed to diagnose assembly resolution.
	public static int Run(bool verbose, Func<int> action)
	{
		try { return action(); }
		catch (Exception error) when (error is not OutOfMemoryException)
		{
			Console.Error.WriteLine(verbose ? error.ToString() : error.Message);
			return 1;
		}
	}

	public static void Write(object value, string? output)
	{
		var json = JsonSerializer.Serialize(value, value.GetType(), Json) + Environment.NewLine;
		if (output is null) { Console.Write(json); return; }
		WriteText(json, output);
	}

	public static void WriteText(string text, string output)
	{
		var path = Path.GetFullPath(output);
		Directory.CreateDirectory(Path.GetDirectoryName(path)!);
		// Replace a complete file atomically, so failed runs leave no partial catalog.
		var temporary = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
		try { File.WriteAllText(temporary, text); File.Move(temporary, path, true); }
		finally { if (File.Exists(temporary)) File.Delete(temporary); }
	}
}
