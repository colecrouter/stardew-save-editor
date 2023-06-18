import { XMLBuilder } from 'fast-xml-parser';
import type { RequestEvent } from './$types';

export const POST = async (event: RequestEvent) => {
    const json = await event.request.json() as SaveFile;
    if (!json) return new Response("No file provided", { status: 400 });
    if (!json || typeof json !== 'object' || 'gameVersion'! in json) return new Response("Not valid save file", { status: 400 });

    // Undo type safety enhancements
    // 1. Inventory, switch undefined into <string xsi:nil="true" />
    // @ts-expect-error
    json.SaveGame.player.items.Item = json.SaveGame.player.items.Item.map((item) => item === undefined ? { '@_xsi:nil': 'true' } : item);

    const builder = new XMLBuilder({ attributeNamePrefix: '@_', ignoreAttributes: false, suppressUnpairedNode: false, suppressEmptyNode: true, suppressBooleanAttributes: false });
    const raw = builder.build(json) as string;
    const xml = raw
        .split('------WebKitFormBoundary')[0]
        .trim()
        .replaceAll('&apos;', '\'')
        .replaceAll('/>', ' />');
    const blob = new Blob([xml], { type: 'text/text' });

    return new Response(blob);
};