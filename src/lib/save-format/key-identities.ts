// Key equality is game behavior, independent of XML syntax. The .NET compiler
// validates these reviewed field layouts before emitting a comparer reference.
export const keyIdentities = {
	"StardewValley.FarmerPair": {
		fields: { Farmer1: "System.Int64", Farmer2: "System.Int64" },
	},
	"Microsoft.Xna.Framework.Vector2": {
		fields: { X: "System.Single", Y: "System.Single" },
	},
} as const;
export type DictionaryKeyComparison =
	| keyof typeof keyIdentities
	| "ordinalIgnoreCase";
