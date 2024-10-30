import { describe, expect, it } from 'vitest';
import { createItem } from '../src/lib/Item';

describe('Item', () => {

    it('should create a Galaxy Sword item correctly', () => {
        expect(createItem('Galaxy Sword')).toMatchObject({
            "category": -98,
            "name": "Galaxy Sword",
            "itemId": "4",
            "stack": 1,
            "minDamage": 60,
            "maxDamage": 80,
            "speed": 8,
            "knockback": 1,
            "critChance": 0.02,
            "critMultiplier": 3,
            "@_xsi:type": "MeleeWeapon"
        });
    });

    it('should create an Iridium Sprinkler item correctly', () => {
        expect(createItem('Iridium Sprinkler')).toMatchObject({
            "category": -8,
            "name": "Iridium Sprinkler",
            "parentSheetIndex": 645,
            "itemId": "645",
            "stack": 1,
            "type": "Crafting",
            "canBeSetDown": true,
            "canBeGrabbed": true,
            "price": 1000,
            "@_xsi:type": "Object"
        });
    });

});