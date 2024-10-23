<script lang="ts">
    import { base } from '$app/paths';
    import { AccessoryIsTinted } from '$lib/CharacterColors';
    import { ItemData } from '$lib/ItemData';
    import { Character } from '$lib/SaveFile';
    import {
        GetPlayerSpriteForPants,
        GetSprite,
        IndexToSprite,
    } from '$lib/Spritesheet';
    import type { Clothing, Hat, ItemInformation } from '$types/items/1.6';
    import {
        type Item,
        type HairstyleColor,
        type Player,
        Gender,
    } from '$types/save/1.6';

    // Async load data
    let PrimarySkinColors: typeof import('$lib/CharacterColors').PrimarySkinColors;
    let SecondarySkinColors: typeof import('$lib/CharacterColors').SecondarySkinColors;
    let TertiarySkinColors: typeof import('$lib/CharacterColors').TertiarySkinColors;

    let PrimaryBootColors: typeof import('$lib/CharacterColors').PrimaryBootColors;
    let SecondaryBootColors: typeof import('$lib/CharacterColors').SecondaryBootColors;
    let TertiaryBootColors: typeof import('$lib/CharacterColors').TertiaryBootColors;
    let QuaternaryBootColors: typeof import('$lib/CharacterColors').QuaternaryBootColors;

    const loaded = new Promise((resolve) => {
        import('$lib/CharacterColors').then((colors) => {
            PrimarySkinColors = colors.PrimarySkinColors;
            SecondarySkinColors = colors.SecondarySkinColors;
            TertiarySkinColors = colors.TertiarySkinColors;

            PrimaryBootColors = colors.PrimaryBootColors;
            SecondaryBootColors = colors.SecondaryBootColors;
            TertiaryBootColors = colors.TertiaryBootColors;
            QuaternaryBootColors = colors.QuaternaryBootColors;

            resolve(true);
        });
    });

    // These props are just here for reactivity, if you would like the preview to update while changing the player's inventory
    // TODO this is probably a huge anti pattern, but I can't think of a beter way to do this without getting jankier
    export let shirtItem: Item | undefined = undefined;
    export let pantsItem: Item | undefined = undefined;
    export let hat: Item | undefined = undefined;
    export let gender: Gender = Gender.Male;
    export let skinColor: number | undefined = undefined;
    export let hairStyle: number | undefined = undefined;
    export let shirt: number | undefined = undefined;
    export let pants: number | undefined = undefined;
    export let acc: number | undefined = undefined;

    let baseSheet = 'male_farmer.png';
    let otherSheet = 'male_farmer_other.png';
    let hairSheet = 'hairstyles.png';
    let armsSheet = 'male_farmer_arms.png';
    let bootsSheet = 'farmer_boots.png';
    const pantsSheet = 'pants.png';
    const shirtSheet = 'shirts.png';
    const accessoriesSheet = 'accessories.png';
    const hatSheet = 'hats.png';

    type pos = { x: number; y: number };
    let pantsPosition: pos = { x: 0, y: 0 };
    let shirtPosition: pos = { x: 0, y: 0 };
    let hairPosition: pos = { x: 0, y: 0 };
    let accessoryPosition: pos = { x: 0, y: 0 };
    let hatPosition: pos = { x: 0, y: 0 };
    let showHair = true;

    let defaultTint: HairstyleColor = {
        R: 0,
        G: 0,
        B: 0,
        A: 0,
        PackedValue: 0,
    };
    let hairTint: HairstyleColor = defaultTint;
    let pantsTint: HairstyleColor = defaultTint;
    let shirtTint: HairstyleColor = defaultTint;
    let baseTint: [HairstyleColor, HairstyleColor, HairstyleColor] = [
        defaultTint,
        defaultTint,
        defaultTint,
    ];
    let eyeTint: HairstyleColor = { R: 0, G: 0, B: 0, A: 0, PackedValue: 0 };
    let bootsTint: [
        HairstyleColor,
        HairstyleColor,
        HairstyleColor,
        HairstyleColor,
    ] = [defaultTint, defaultTint, defaultTint, defaultTint];

    let character: Player | undefined;
    Character.character.subscribe((c) => {
        if (!c) return;

        character = c;
    });

    // Just here for reactivity
    $: shirtItem ||
        pantsItem ||
        hat ||
        gender ||
        skinColor ||
        hairStyle ||
        shirt ||
        pants ||
        acc,
        (async () => {
            await loaded;
            if (character) {
                if (gender === Gender.Male) {
                    baseSheet = 'male_farmer.png';
                    armsSheet = 'male_farmer_arms.png';
                } else {
                    baseSheet = 'female_farmer.png';
                    armsSheet = 'female_farmer_arms.png';
                }

                const isMale = gender === Gender.Male;
                otherSheet = isMale
                    ? 'male_farmer_other.png'
                    : 'female_farmer_other.png';
                bootsSheet = isMale
                    ? 'male_farmer_boots.png'
                    : 'female_farmer_boots.png';

                baseTint[0] = PrimarySkinColors[character.skin];
                baseTint[1] = SecondarySkinColors[character.skin];
                baseTint[2] = TertiarySkinColors[character.skin];
                eyeTint = character.newEyeColor;

                if (!character.pantsItem) {
                    // Underwear/default
                    const underwear = ItemData.get(
                        'Polka Dot Shorts',
                    ) as Clothing;
                    pantsPosition = GetPlayerSpriteForPants(
                        underwear.SpriteIndex,
                        isMale,
                    );
                    pantsTint = defaultTint;
                } else {
                    const pants = character.pantsItem;
                    const pantsData = ItemData.get(pants.name) as Clothing;

                    pantsData &&
                        (pantsPosition = GetPlayerSpriteForPants(
                            pantsData.SpriteIndex,
                            isMale,
                        )); // We don't use pants.sprite because there are seperate sprites for item and on character
                    pants.clothesColor && (pantsTint = pants.clothesColor);
                }

                const shirt = character.shirtItem;
                if (!shirt) {
                    // White shirt/default
                    console.log(isMale);
                    const shirtData = ItemData.get(
                        isMale ? 'Basic Pullover (M)' : 'Basic Pullover (F)',
                    ) as Clothing;
                    shirtPosition = GetSprite(
                        'Shirt',
                        shirtData.SpriteIndex,
                        shirtData.CanBeDyed,
                    );
                    shirtTint = defaultTint;
                } else {
                    const shirtData = ItemData.get(shirt.name) as Clothing;

                    if (shirtData) {
                        shirtPosition = GetSprite(
                            'Shirt',
                            shirtData.SpriteIndex,
                            shirtData.CanBeDyed,
                        );
                        shirtTint =
                            (shirtData.CanBeDyed && shirt.clothesColor) ||
                            defaultTint;
                    }
                }

                let hatData: Hat | undefined;
                if (character.hat?.name === 'Copper Pan') {
                    // I hate this so much, but there's no way to grab the info from ItemData because +layout.ts converts iteminfo.json into a Map,
                    // so the hat entry gets nuked. Maybe in the future we'll use a Map<string, Array<ItemInformation>> instead.
                    const res = await fetch(base + '/iteminfo.json');
                    const allItems = (await res.json()) as Array<
                        [string, ItemInformation]
                    >;
                    const pan = allItems.find(
                        ([name]) => name === 'Copper Pan',
                    )![1];
                    hatData = pan as Hat;
                } else {
                    hatData =
                        character.hat &&
                        (ItemData.get(character.hat.name) as Hat);
                }

                if (hatData) {
                    hatPosition = hatData.Sprite;
                    showHair = hatData?._type == 'Hat' && hatData.ShowRealHair;
                }

                const hair = character.hair;
                hairPosition = IndexToSprite(hair, 16, 96, 128, 672);
                hairTint = character.hairstyleColor;
                showHair = hatData?._type !== 'Hat' || hatData.ShowRealHair;

                if (character.accessory !== -1) {
                    accessoryPosition = IndexToSprite(
                        character.accessory, // Because index starts at 0 but game displays at 1
                        16,
                        32,
                        128,
                        128,
                    );
                }

                if (character.boots) {
                    const boots = character.boots;
                    bootsTint[0] = PrimaryBootColors[boots.indexInColorSheet];
                    bootsTint[1] = SecondaryBootColors[boots.indexInColorSheet];
                    bootsTint[2] = TertiaryBootColors[boots.indexInColorSheet];
                    bootsTint[3] =
                        QuaternaryBootColors[boots.indexInColorSheet];
                } else {
                    bootsTint[0] = defaultTint;
                    bootsTint[1] = defaultTint;
                    bootsTint[2] = defaultTint;
                    bootsTint[3] = defaultTint;
                }
            }
        })();
</script>

<div class="appearance" class:female={gender === Gender.Female}>
    {#await loaded then}
        <!-- START LAYERED TINT -->
        <div
            class="base"
            style:--spritesheet={`url(${base}/img/${baseSheet})`}
            style:--tint={`rgba(${baseTint[2].R},${baseTint[2].G},${baseTint[2].B},${baseTint[2].A})`}
            style:--x={'16px'}
            style:--y={'0'} />
        <div
            class="base"
            style:--spritesheet={`url(${base}/img/${baseSheet})`}
            style:--tint={`rgba(${baseTint[1].R},${baseTint[1].G},${baseTint[1].B},${baseTint[1].A})`}
            style:--x={'32px'}
            style:--y={'0'} />
        <div
            class="base"
            style:--spritesheet={`url(${base}/img/${baseSheet})`}
            style:--tint={`rgba(${baseTint[0].R},${baseTint[0].G},${baseTint[0].B},${baseTint[0].A})`}
            style:--x={'48px'}
            style:--y={'0'} />
        <!-- END LAYERED TINT -->

        <div
            class="eyes"
            style:--spritesheet={`url(${base}/img/${otherSheet})`} />

        <!-- START LAYERED TINT -->
        <div
            class="iris"
            style:--spritesheet={`url(${base}/img/${otherSheet})`}
            style:--tint={`rgba(${eyeTint.R},${eyeTint.G},${eyeTint.B},${eyeTint.A})`}
            style:--x={'32px'}
            style:--y={'0'} />
        <!-- END LAYERED TINT -->

        <!-- START LAYERED TINT -->
        <div
            class="boots"
            style:--spritesheet={`url(${base}/img/${bootsSheet})`}
            style:--x={'48px'}
            style:--y={'0'}
            style:--tint={`rgba(${bootsTint[0].R},${bootsTint[0].G},${bootsTint[0].B},${bootsTint[0].A})`} />
        <div
            class="boots"
            style:--spritesheet={`url(${base}/img/${bootsSheet})`}
            style:--x={'32px'}
            style:--y={'0'}
            style:--tint={`rgba(${bootsTint[1].R},${bootsTint[1].G},${bootsTint[1].B},${bootsTint[1].A})`} />
        <div
            class="boots"
            style:--spritesheet={`url(${base}/img/${bootsSheet})`}
            style:--x={'0px'}
            style:--y={'0'}
            style:--tint={`rgba(${bootsTint[2].R},${bootsTint[2].G},${bootsTint[2].B},${bootsTint[2].A})`} />
        <div
            class="boots"
            style:--spritesheet={`url(${base}/img/${bootsSheet})`}
            style:--x={'16px'}
            style:--y={'0'}
            style:--tint={`rgba(${bootsTint[3].R},${bootsTint[3].G},${bootsTint[3].B},${bootsTint[3].A})`} />
        <!-- END LAYERED TINT -->

        <div
            class="pants"
            style:--spritesheet={`url(${base}/assets/${pantsSheet})`}
            style:--x={`${pantsPosition.x}px`}
            style:--y={`${pantsPosition.y}px`}
            style:--tint={`rgba(${pantsTint.R},${pantsTint.G},${pantsTint.B},${pantsTint.A})`} />
        <div
            class="shirt"
            style:--spritesheet={`url(${base}/assets/${shirtSheet})`}
            style:--x={`${shirtPosition.x}px`}
            style:--y={`${shirtPosition.y}px`}
            style:--tint={`rgba(${shirtTint.R},${shirtTint.G},${shirtTint.B},${shirtTint.A})`} />

        {#if character?.accessory !== -1}
            <!-- START LAYERED TINT -->
            <div
                class="accessory"
                style:--spritesheet={`url(${base}/assets/${accessoriesSheet})`}
                style:--tint={character?.accessory !== undefined &&
                AccessoryIsTinted(character?.accessory)
                    ? `rgba(${hairTint.R},${hairTint.G},${hairTint.B},${hairTint.A})`
                    : ''}
                style:--x={`${accessoryPosition.x}px`}
                style:--y={`${accessoryPosition.y}px`} />
            <!-- END LAYERED TINT -->
        {/if}

        {#if showHair}
            <div
                class="hair"
                style:--spritesheet={`url(${base}/assets/${hairSheet})`}
                style:--x={`${hairPosition.x}px`}
                style:--y={`${hairPosition.y}px`}
                style:--tint={`rgba(${hairTint.R},${hairTint.G},${hairTint.B},${hairTint.A})`} />
        {/if}

        {#if character?.hat}
            <div
                class="hat"
                style:--spritesheet={`url(${base}/assets/${hatSheet})`}
                style:--x={`${hatPosition.x}px`}
                style:--y={`${hatPosition.y}px`} />
        {/if}

        <!-- START LAYERED TINT -->
        <div
            class="arms"
            style:--spritesheet={`url(${base}/img/${armsSheet})`}
            style:--tint={`rgba(${baseTint[2].R},${baseTint[2].G},${baseTint[2].B},${baseTint[2].A})`}
            style:--x={'16px'}
            style:--y={'0'} />
        <div
            class="arms"
            style:--spritesheet={`url(${base}/img/${armsSheet})`}
            style:--tint={`rgba(${baseTint[1].R},${baseTint[1].G},${baseTint[1].B},${baseTint[1].A})`}
            style:--x={'32px'}
            style:--y={'0'} />
        <div
            class="arms"
            style:--spritesheet={`url(${base}/img/${armsSheet})`}
            style:--tint={`rgba(${baseTint[0].R},${baseTint[0].G},${baseTint[0].B},${baseTint[0].A})`}
            style:--x={'48px'}
            style:--y={'0'} />
        <!-- END LAYERED TINT -->
    {/await}
</div>

<style>
    .appearance {
        position: relative;
        width: 50px;
        height: 90px;
        margin: 6px;
    }

    .appearance > div {
        position: absolute;
        width: 16px;
        height: 32px;
        zoom: 2.5;
        margin-left: 2px;
        background-image: var(--spritesheet);
        background-position: left var(--x) top var(--y);
    }

    .appearance > div::after {
        content: '';
        position: absolute;
        height: 100%;
        width: 100%;
        background: var(--tint);
        mask-image: var(--spritesheet);
        mask-position: left var(--x) top var(--y);
        -webkit-mask-image: var(--spritesheet);
        -webkit-mask-position: left var(--x) top var(--y);
    }

    .appearance::before {
        content: '';
        position: absolute;
        background-image: url(/assets/daybg.png);
        background-size: cover;
        background-position: center;
        width: 100%;
        height: 100%;
        padding: 6px 0;
        margin-top: -6px;
    }

    .appearance::after {
        content: '';
        position: absolute;
        width: 100%;
        height: 100%;
        box-shadow:
            0 0 0 2px #8e3d04,
            0 0 0 4px #d97804,
            0 0 0 6px #5b2b29;
        border-radius: 2px;
    }

    .pants {
        height: 32px !important;
        width: 16px !important;
    }

    .shirt {
        height: 8px !important;
        width: 8px !important;
        top: 15px;
        left: 4px;
    }

    .hair,
    .accessory {
        position: relative;
        height: 16px !important;
        top: 2px;
    }

    .hair {
        top: 1px;
    }

    .hat {
        height: 16px !important;
        width: 20px !important;
        top: -1px;
        left: -2px;
    }

    .pants::after,
    .shirt::after,
    .hair::after,
    .accessory::after {
        mix-blend-mode: multiply;
    }

    .base::after,
    .arms::after,
    .iris::after,
    .boots::after {
        mix-blend-mode: normal !important;
        -webkit-mix-blend-mode: normal !important;
    }

    .appearance.female .hat {
        top: 0px;
    }
    .appearance.female .accessory {
        top: 3px;
    }

    .appearance.female .shirt {
        top: 16px;
    }

    .appearance.female .hair {
        top: 2px;
    }

    /* .appearance.pants .accessory {
        height: ;
    } */
</style>
