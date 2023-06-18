import type { ObjectInformation, BigCraftable, Boots, Clothing, Furniture, Hat, Weapon, Tool } from "$types/dump";

export const GetSpritesheet = (lookupItem: ObjectInformation | BigCraftable | Boots | Clothing | Furniture | Hat | Weapon | Tool): string => {
    let spritesheet = '';
    switch (lookupItem?._type) {
        case 'ObjectInformation':
        case 'Boots':
            spritesheet = 'springobjects.png';
            break;
        case 'BigCraftable':
            spritesheet = 'Craftables.png';
            break;
        case 'Hat':
            spritesheet = 'hats.png';
        case 'Clothing':
            switch (lookupItem._type) {
                case 'Clothing':
                    switch (lookupItem.type) {
                        case 'Pants':
                            spritesheet = 'pants.png';
                            break;
                        case 'Shirt':
                            spritesheet = 'shirts.png';
                            break;
                        default: // Accessory
                            throw new Error('Not real clothing type');
                            break;
                    }
                    break;
                case 'Hat':
                    spritesheet = 'hats.png';
                    break;
            }
            // TODO
            break;
        case 'Furniture':
            spritesheet = 'furniture.png';
            break;
        case 'RangedWeapon':
        case 'MeleeWeapon':
            spritesheet = 'weapons.png';
            break;
        case 'Tool':
            spritesheet = 'tools.png';
            break;
        default:
            // @ts-expect-error
            console.warn('Unknown item type', lookupItem?._type);
    };

    return spritesheet;
};