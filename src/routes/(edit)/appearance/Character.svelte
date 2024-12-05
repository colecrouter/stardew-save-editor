<script lang="ts">
    import { base } from "$app/paths";
    import {
        PrimaryBootColors,
        PrimarySkinColors,
        QuaternaryBootColors,
        SecondaryBootColors,
        SecondarySkinColors,
        TertiaryBootColors,
        TertiarySkinColors,
    } from "$lib/CharacterColors";
    import { Sprite } from "$lib/Sprite";
    import { Color } from "$lib/proxies/Color";
    import type { Farmer } from "$lib/proxies/Farmer";
    import { Item } from "$lib/proxies/Item";
    import type { Coordinates } from "$types/items/1.6";
    import { type Color as ColorType, Gender } from "$types/save/1.6";

    interface Props {
        player: Farmer;
    }

    let { player }: Props = $props();

    let gender = $derived(player.gender.toLowerCase());

    // Spritesheets
    let baseSheet = $derived(`${base}/img/${gender}_farmer.png`);
    let otherSheet = $derived(`${base}/img/${gender}_farmer_other.png`);
    let armsSheet = $derived(`${base}/img/${gender}_farmer_arms.png`);
    let bootsSheet = $derived(`${base}/img/${gender}_farmer_boots.png`);
    const hairSheet = `${base}/assets/hairstyles.png`;
    const pantsSheet = `${base}/assets/pants.png`;
    const shirtSheet = `${base}/assets/shirts.png`;
    const accessoriesSheet = `${base}/assets/accessories.png`;
    const hatSheet = `${base}/assets/hats.png`;

    const underwear = Item.fromName("Polka Dot Shorts");
    const undershirt = $derived(
        Item.fromName(
            player.gender === Gender.Male
                ? "Basic Pullover (M)"
                : "Basic Pullover (F)",
        ),
    );

    let hat = $derived(player.hat);
    let shirt = $derived(player.shirt ?? undershirt);
    let pants = $derived(player.pants ?? underwear);
    let boots = $derived(player.boots);

    // Calculate sprite X and Y positions
    let hatPosition = $derived(hat?.sprite.dimensions);
    let hairPosition = $derived(
        Sprite.indexToSprite(player.hairstyle, 16, 96, 128, 672),
    );
    let accessoryPosition = $derived(
        Sprite.indexToSprite(player.accessory, 16, 32, 128, 128),
    );
    let shirtPosition = $derived(shirt.sprite.dimensions);
    let pantsPosition = $derived(pants.sprite.dimensions);
    let showHair = $derived(
        hat === undefined || hat.info._type !== "Hat" || !hat.info.showRealHair,
    );

    // Tint colors
    let defaultTint = new Color("#00000000");
    let pantsTint = $derived(
        pants.info._type === "Pants" && pants.info.canBeDyed && pants?.color
            ? pants.color
            : new Color("#00000000"),
    );
    let hairTint: ColorType = $derived(player.hairColor);
    let shirtTint: ColorType = $derived(
        shirt?.info._type === "Shirt" && shirt.info.canBeDyed && shirt?.color
            ? shirt.color
            : new Color("#00000000"),
    );
    let skinTones = $derived<[ColorType, ColorType, ColorType]>([
        PrimarySkinColors[player.skin] ?? defaultTint,
        SecondarySkinColors[player.skin] ?? defaultTint,
        TertiarySkinColors[player.skin] ?? defaultTint,
    ]);
    let eyeTint = $derived(player.eyeColor);
    let bootTints = $derived<[ColorType, ColorType, ColorType, ColorType]>(
        player.boots
            ? [
                  PrimaryBootColors[player.boots?.raw.indexInColorSheet ?? 0] ??
                      defaultTint,
                  SecondaryBootColors[
                      player.boots?.raw.indexInColorSheet ?? 0
                  ] ?? defaultTint,
                  TertiaryBootColors[
                      player.boots?.raw.indexInColorSheet ?? 0
                  ] ?? defaultTint,
                  QuaternaryBootColors[
                      player.boots?.raw.indexInColorSheet ?? 0
                  ] ?? defaultTint,
              ]
            : [defaultTint, defaultTint, defaultTint, defaultTint],
    );
</script>

{#snippet layer(
    className: string,
    spritesheet: string,
    location?: Coordinates,
    tint?: ColorType,
)}
    <div
        class={className}
        style:--spritesheet={`url(${spritesheet})`}
        style:--tint={tint
            ? `rgba(${tint.R}, ${tint.G}, ${tint.B}, ${tint.A})`
            : undefined}
        style:--x={location ? `${location.x}px` : undefined}
        style:--y={location ? `${location.y}px` : undefined}
    ></div>
{/snippet}

<div class="appearance" class:female={player.gender === Gender.Female}>
    <!-- START LAYERED TINT -->
    {@render layer("base", baseSheet, { x: 16, y: 0 }, skinTones[2])}
    {@render layer("base", baseSheet, { x: 32, y: 0 }, skinTones[1])}
    {@render layer("base", baseSheet, { x: 48, y: 0 }, skinTones[0])}
    <!-- END LAYERED TINT -->

    {@render layer("eyes", otherSheet, { x: 0, y: 0 })}

    <!-- START LAYERED TINT -->
    {@render layer("iris", otherSheet, { x: 32, y: 0 }, eyeTint)}
    <!-- END LAYERED TINT -->

    <!-- START LAYERED TINT -->
    {@render layer("boots", bootsSheet, { x: 48, y: 0 }, bootTints[0])}
    {@render layer("boots", bootsSheet, { x: 32, y: 0 }, bootTints[1])}
    {@render layer("boots", bootsSheet, { x: 0, y: 0 }, bootTints[2])}
    {@render layer("boots", bootsSheet, { x: 16, y: 0 }, bootTints[3])}
    <!-- END LAYERED TINT -->

    {@render layer("pants", pantsSheet, pantsPosition, pantsTint)}
    {@render layer("shirt", shirtSheet, shirtPosition, shirtTint)}

    {#if player.accessory !== -1}
        {@render layer(
            "accessory",
            accessoriesSheet,
            accessoryPosition,
            hairTint,
        )}
    {/if}

    {#if showHair}
        {@render layer("hair", hairSheet, hairPosition, hairTint)}
    {/if}

    {#if hatPosition}
        {@render layer("hat", hatSheet, hatPosition, new Color("#00000000"))}
    {/if}

    <!-- START LAYERED TINT -->
    {@render layer("arms", armsSheet, { x: 16, y: 0 }, skinTones[2])}
    {@render layer("arms", armsSheet, { x: 32, y: 0 }, skinTones[1])}
    {@render layer("arms", armsSheet, { x: 48, y: 0 }, skinTones[0])}
    <!-- END LAYERED TINT -->
</div>

<style>
    .appearance {
        position: relative;
        width: 38px;
        height: 80px;
    }

    .appearance > div {
        position: absolute;
        width: 16px;
        height: 32px;
        zoom: 2.5;
        background-image: var(--spritesheet);
        background-position: left var(--x) top var(--y);
    }

    .appearance > div::after {
        content: "";
        position: absolute;
        height: 100%;
        width: 100%;
        background: var(--tint);
        mask-image: var(--spritesheet);
        mask-position: left var(--x) top var(--y);
        -webkit-mask-image: var(--spritesheet);
        -webkit-mask-position: left var(--x) top var(--y);
    }

    .pants {
        height: 32px !important;
        width: 16px !important;
        top: 17px;
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
        top: -2px;
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
        top: -1px;
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
