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

    const parser = new XMLParser();
    const json = parser.parse(xml) as unknown;

    if (!json || typeof json !== 'object' || 'gameVersion'! in json) return new Response("Not valid save file", { status: 400 });

    return new Response(JSON.stringify(json, null, 2));
};