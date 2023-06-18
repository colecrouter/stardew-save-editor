import { XMLParser } from 'fast-xml-parser';
import type { RequestEvent } from './$types';

export const POST = async (event: RequestEvent) => {
    const file = event.request.body;
    if (!file) return new Response("No file provided", { status: 400 });

    // Big xml file, need to read it in chunks
    let xml = "";
    const reader = file.getReader();
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        xml += value.toString();
    }

    const parser = new XMLParser({ ignoreAttributes: false, allowBooleanAttributes: true });
    const json = parser.parse(xml) as SaveFile;

    if (!json || typeof json !== 'object' || 'gameVersion'! in json) return new Response("Not valid save file", { status: 400 });

    // Type safety enhancements
    // 1. Inventory, switch <string xsi:nil="true" /> into undefined
    json.SaveGame.player.items.Item = json.SaveGame.player.items.Item.map((item) => JSON.stringify(item) === '{"@_xsi:nil":"true"}' ? undefined : item);

    return new Response(JSON.stringify(json, null, 2));
};