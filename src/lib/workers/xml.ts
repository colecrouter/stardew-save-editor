/*
    The purpose of this worker is to improve performance by extracting the XML parsing
    from the main thread. This also has the benefit of making it "async", which lets us create
    a loading screen while the XML is being parsed.

    Apparently this is an issue on some of the devices users are using (mainly mobile devices).
*/

import * as Comlink from "comlink";
import { XMLBuilder, XMLParser } from "fast-xml-parser";

// The XML parser has no idea what should be an array and what should be an object
// This isn't a huge deal, but we can make it a little easier to work with by
// supplying a list of things we want to be arrays
const arrayTags = new Set([
    "item",
    "GameLocations",
    "characters",
    // "objects",
    "Farmer",
]);

export class XMLManager {
    private parser = new XMLParser({
        ignoreAttributes: false,
        allowBooleanAttributes: true,
        isArray: (tagName) => arrayTags.has(tagName),
    });

    public parse<T>(xml: string) {
        console.log("Parsing XML");
        return this.parser.parse(xml) as T;
    }

    public stringify<T>(obj: T) {
        const builder = new XMLBuilder({
            attributeNamePrefix: "@_",
            ignoreAttributes: false,
            suppressUnpairedNode: false,
            suppressEmptyNode: true,
            suppressBooleanAttributes: false,
        });
        const raw = builder.build(obj) as string;
        const xml = raw
            .split("------WebKitFormBoundary")[0]
            ?.trim()
            .replaceAll("&apos;", "'")
            .replaceAll("/>", " />");
        if (!xml) throw new Error("Failed to generate XML");

        // Create UTF-8 BOM bytes
        const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
        // Convert XML string to UTF-8 encoded bytes
        const xmlBytes = new TextEncoder().encode(xml);
        // Combine BOM and XML bytes
        const combinedArray = new Uint8Array(bom.length + xmlBytes.length);
        combinedArray.set(bom);
        combinedArray.set(xmlBytes, bom.length);

        const blob = new Blob([combinedArray], {
            type: "text/text; charset=UTF-8",
        });

        return blob;
    }
}

Comlink.expose(XMLManager);
