# Vendored StardewXnbHack

These C# sources are copied without changes from
[Pathoschild/StardewXnbHack](https://github.com/Pathoschild/StardewXnbHack/tree/e0b5d500bb8cb058c05325d1c6994765f7571256/StardewXnbHack),
commit `e0b5d500bb8cb058c05325d1c6994765f7571256` (version 1.1.2).
The upstream MIT license is in `LICENSE`.

The parent project replaces the upstream build configuration and entry point,
which require a SMAPI installation, while retaining the unpacker and its writers.
When updating, replace these sources together and verify JSON, PNG and TMX output
against the generator. Keep the upstream sources unmodified so updates are easy
to compare.
