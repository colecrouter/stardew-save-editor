using System.Text.Json;
using System.Xml.Serialization;

// This fixture is intentionally ordinary XmlSerializer code. It is an independent
// oracle for reflected metadata, null slots and concrete type reconstruction.
var serializer = new XmlSerializer(typeof(StardewValley.SaveGame));
if (args.FirstOrDefault() == "write")
{
	serializer.Serialize(Console.Out, new StardewValley.SaveGame
	{
		Money = 7,
		FarmerId = 9007199254740993L,
		Name = "007",
		Status = new() { "Ready" },
		Equipped = new() { new StardewValley.Tool { Name = "Boots", Level = 1 } },
		Day = null,
		Items = [new StardewValley.Tool { Name = "Axe", Level = 2 }, null]
	});
}
else
{
	var save = (StardewValley.SaveGame)serializer.Deserialize(Console.In)!;
	Console.Write(JsonSerializer.Serialize(new
	{
		save.Money,
		save.FarmerId,
		save.Name,
		save.Day,
		Status = save.Status.Value.ToString(),
		Equipped = save.Equipped.Value?.Name,
		Items = save.Items.Select(item => item is null ? null : new { Type = item.GetType().Name, item.Name, Level = (item as StardewValley.Tool)?.Level })
	}));
}
namespace StardewValley
{
	public class SaveGame
	{
		// Exercise the same enum attribute argument in direct-reflection and
		// catalog-JSON generation paths; both must interpret Form identically.
		[XmlElement(Form = System.Xml.Schema.XmlSchemaForm.Unqualified)]
		public int Money;
		public long FarmerId;
		public string Name = "";
		public int? Day;
		public List<Item?> Items = [];
		[XmlElement("Status")]
		public Netcode.NetEnum<Status> Status = new();
		[XmlElement("Equipped")]
		public Netcode.NetRef<Tool> Equipped = new();
	}
	public enum Status { Ready, Done }
	[XmlInclude(typeof(Tool))]
	public class Item { public string Name = ""; }
	public class Tool : Item { public int Level; }
}

namespace Netcode
{
	// Match the game's one-value enumerable contract independently of the TS runtime.
	public class NetField<T, TSelf> : IEnumerable<T> where T : class
	{
		[XmlIgnore] public T? Value;
		public void Add(T value) => Value = value;
		public IEnumerator<T> GetEnumerator() { if (Value is not null) yield return Value; }
		System.Collections.IEnumerator System.Collections.IEnumerable.GetEnumerator() => GetEnumerator();
	}
	public class NetRef<T> : NetField<T, NetRef<T>> where T : class { }

	// NetEnum exposes one enum name through IEnumerable<string>, separately from
	// the NetField inheritance chain used by other network fields.
	public class NetEnum<T> : IEnumerable<string> where T : struct, Enum
	{
		[XmlIgnore] public T Value;
		public void Add(string value) => Value = Enum.Parse<T>(value);
		public IEnumerator<string> GetEnumerator() { yield return Value.ToString(); }
		System.Collections.IEnumerator System.Collections.IEnumerable.GetEnumerator() => GetEnumerator();
	}
}
