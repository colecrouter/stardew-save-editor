using System;
using Force.DeepCloner;
using Microsoft.Xna.Framework.Content;
using Newtonsoft.Json;
using StardewModdingAPI.Toolkit.Serialization;
using StardewModdingAPI.Toolkit.Utilities;

namespace StardewXnbHack.Framework.Writers;

/// <summary>The base class for an asset writer.</summary>
internal abstract class BaseAssetWriter : IAssetWriter
{
    /*********
    ** Private methods
    *********/
    /// <summary>The settings to use when serializing JSON.</summary>
    private readonly Lazy<JsonSerializerSettings> JsonSettings;


    /*********
    ** Public methods
    *********/
    /// <summary>Whether the writer can handle a given asset.</summary>
    /// <param name="asset">The asset value.</param>
    public abstract bool CanWrite(object asset);

    /// <summary>Write an asset instance to disk.</summary>
    /// <param name="asset">The asset value.</param>
    /// <param name="toPathWithoutExtension">The absolute path to the export file, without the file extension.</param>
    /// <param name="relativePath">The relative path within the content folder.</param>
    /// <param name="platform">The operating system running the unpacker.</param>
    /// <param name="error">An error phrase indicating why writing to disk failed (if applicable).</param>
    /// <returns>Returns whether writing to disk completed successfully.</returns>
    public abstract bool TryWriteFile(object asset, string toPathWithoutExtension, string relativePath, Platform platform, out string error);


    /*********
    ** Protected methods
    *********/
    /// <summary>Construct an instance.</summary>
    /// <param name="omitDefaultFields">Whether to ignore members marked <see cref="ContentSerializerAttribute.Optional"/> which match the default value.</param>
    protected BaseAssetWriter(bool omitDefaultFields = false)
    {
        this.JsonSettings = new(() => BaseAssetWriter.GetJsonSerializerSettings(omitDefaultFields));
    }

    /// <summary>Get a text representation for the given asset.</summary>
    /// <param name="asset">The asset to serialize.</param>
    protected string FormatData(object asset)
    {
        return JsonConvert.SerializeObject(asset, this.JsonSettings.Value);
    }

    /// <summary>Get the recommended file extension for a data file formatted with <see cref="FormatData"/>.</summary>
    protected string GetDataExtension()
    {
        return "json";
    }

    /// <summary>Get the serializer settings to apply when writing JSON.</summary>
    /// <param name="omitDefaultFields">Whether to ignore members marked <see cref="ContentSerializerAttribute.Optional"/> which match the default value.</param>
    private static JsonSerializerSettings GetJsonSerializerSettings(bool omitDefaultFields = false)
    {
        JsonHelper jsonHelper = new();
        JsonSerializerSettings settings = jsonHelper.JsonSettings.DeepClone();

        settings.ContractResolver = new IgnoreDefaultOptionalPropertiesResolver(omitDefaultFields);

        return settings;
    }
}
