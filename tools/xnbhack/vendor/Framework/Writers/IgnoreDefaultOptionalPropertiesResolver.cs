using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using Microsoft.Xna.Framework.Content;
using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;
using Sickhead.Engine.Util;

namespace StardewXnbHack.Framework.Writers;

/// <summary>A Json.NET contract resolver which ignores properties marked with <see cref="ContentSerializerIgnoreAttribute"/>, or (optionally) marked <see cref="ContentSerializerAttribute.Optional"/> with the default value.</summary>
internal class IgnoreDefaultOptionalPropertiesResolver : DefaultContractResolver
{
    /*********
    ** Fields
    *********/
    /// <summary>Whether to ignore members marked <see cref="ContentSerializerAttribute.Optional"/> which match the default value.</summary>
    private readonly bool OmitDefaultValues;

    /// <summary>The default values for fields and properties marked <see cref="ContentSerializerAttribute.Optional"/>.</summary>
    private readonly Dictionary<string, Dictionary<string, object>> DefaultValues = new();


    /*********
    ** Public methods
    *********/
    /// <summary>Construct an instance.</summary>
    /// <param name="omitDefaultValues">Whether to ignore members marked <see cref="ContentSerializerAttribute.Optional"/> which match the default value.</param>
    public IgnoreDefaultOptionalPropertiesResolver(bool omitDefaultValues)
    {
        this.OmitDefaultValues = omitDefaultValues;
    }


    /*********
    ** Protected methods
    *********/
    /// <inheritdoc />
    protected override JsonProperty CreateProperty(MemberInfo member, MemberSerialization memberSerialization)
    {
        JsonProperty property = base.CreateProperty(member, memberSerialization);

        // property marked ignore
        if (member.GetCustomAttribute<ContentSerializerIgnoreAttribute>() != null)
            property.ShouldSerialize = _ => false;

        // property marked optional which matches default value
        else if (this.OmitDefaultValues)
        {
            Dictionary<string, object>? optionalMembers = this.GetDefaultValues(member.DeclaringType);
            if (optionalMembers != null && optionalMembers.TryGetValue(member.Name, out object defaultValue))
            {
                property.ShouldSerialize = instance =>
                {
                    object value = member.GetValue(instance);
                    return !defaultValue?.Equals(value) ?? value is not null;
                };
            }
        }

        return property;
    }

    /// <summary>The default values for a type's fields and properties marked <see cref="ContentSerializerAttribute.Optional"/>, if any.</summary>
    /// <param name="type">The type whose fields and properties to get default values for.</param>
    /// <returns>Returns a dictionary of default values by member name if any were found, else <c>null</c>.</returns>
    private Dictionary<string, object>? GetDefaultValues(Type type)
    {
        // skip invalid
        if (!type.IsClass || type.FullName is null || type.Namespace?.StartsWith("StardewValley") != true)
            return null;

        // skip if already cached
        if (this.DefaultValues.TryGetValue(type.FullName, out Dictionary<string, object> defaults))
            return defaults;

        // get members
        MemberInfo[] optionalMembers =
            (type.GetFields().OfType<MemberInfo>())
            .Concat(type.GetProperties())
            .Where(member => member.GetCustomAttribute<ContentSerializerAttribute>()?.Optional is true)
            .ToArray();
        if (optionalMembers.Length == 0)
            return this.DefaultValues[type.FullName] = null;

        // get default instance
        object defaultInstance;
        try
        {
            defaultInstance = Activator.CreateInstance(type);
        }
        catch
        {
            return this.DefaultValues[type.FullName] = null;
        }

        // get default values
        defaults = new Dictionary<string, object>();
        foreach (MemberInfo member in optionalMembers)
            defaults[member.Name] = member.GetValue(defaultInstance);
        return this.DefaultValues[type.FullName] = defaults;
    }
}
