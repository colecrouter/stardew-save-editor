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
	}
	[XmlInclude(typeof(Tool))]
	public class Item { public string Name = ""; }
	public class Tool : Item { public int Level; }
}
