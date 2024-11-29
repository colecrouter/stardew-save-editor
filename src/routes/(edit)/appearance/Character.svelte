<script lang="ts">
    import { base } from "$app/paths";
    import {
        AccessoryIsTinted,
        PrimaryBootColors,
        PrimarySkinColors,
        QuaternaryBootColors,
        SecondaryBootColors,
        SecondarySkinColors,
        TertiaryBootColors,
        TertiarySkinColors,
    } from "$lib/CharacterColors";
    import { GetPlayerSpriteForPants, IndexToSprite } from "$lib/Spritesheet";
    import { Color } from "$lib/proxies/Color";
    import type { Farmer } from "$lib/proxies/Farmer";
    import { Item } from "$lib/proxies/Item";
    import { type Color as ColorType, Gender } from "$types/save/1.6";

    interface Props {
        player: Farmer;
    }

    let { player }: Props = $props();

    let gender = $derived(player.gender.toLowerCase());

    // Spritesheets
    let baseSheet = $derived(`${gender}_farmer.png`);
    let otherSheet = $derived(`${gender}_farmer_other.png`);
    let armsSheet = $derived(`${gender}_farmer_arms.png`);
    let bootsSheet = $derived(`${gender}_farmer_boots.png`);
    const hairSheet = "hairstyles.png";
    const pantsSheet = "pants.png";
    const shirtSheet = "shirts.png";
    const accessoriesSheet = "accessories.png";
    const hatSheet = "hats.png";

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

    // Pants are special
    let pantsSprite = $derived(
        GetPlayerSpriteForPants(
            Number(pants.info._key),
            player.gender === Gender.Male,
        ),
    );

    // Calculate sprite X and Y positions
    let hatPosition = $derived(hat?.sprite.dimensions);
    let hairPosition = $derived(
        IndexToSprite(player.hairstyle, 16, 96, 128, 672),
    );
    let accessoryPosition = $derived(
        IndexToSprite(player.accessory, 16, 32, 128, 128),
    );
    let shirtPosition = $derived(shirt.sprite.dimensions);
    let pantsPosition = $derived(pantsSprite);
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

<div class="appearance" class:female={player.gender === Gender.Female}>
    <!-- START LAYERED TINT -->
    <div
        class="base"
        style:--spritesheet={`url(${base}/img/${baseSheet})`}
        style:--tint={`rgba(${skinTones[2].R},${skinTones[2].G},${skinTones[2].B},${skinTones[2].A})`}
        style:--x={"16px"}
        style:--y={"0"}
    ></div>
    <div
        class="base"
        style:--spritesheet={`url(${base}/img/${baseSheet})`}
        style:--tint={`rgba(${skinTones[1].R},${skinTones[1].G},${skinTones[1].B},${skinTones[1].A})`}
        style:--x={"32px"}
        style:--y={"0"}
    ></div>
    <div
        class="base"
        style:--spritesheet={`url(${base}/img/${baseSheet})`}
        style:--tint={`rgba(${skinTones[0].R},${skinTones[0].G},${skinTones[0].B},${skinTones[0].A})`}
        style:--x={"48px"}
        style:--y={"0"}
    ></div>
    <!-- END LAYERED TINT -->

    <div
        class="eyes"
        style:--spritesheet={`url(${base}/img/${otherSheet})`}
    ></div>

    <!-- START LAYERED TINT -->
    <div
        class="iris"
        style:--spritesheet={`url(${base}/img/${otherSheet})`}
        style:--tint={`rgba(${eyeTint.R},${eyeTint.G},${eyeTint.B},${eyeTint.A})`}
        style:--x={"32px"}
        style:--y={"0"}
    ></div>
    <!-- END LAYERED TINT -->

    <!-- START LAYERED TINT -->
    <div
        class="boots"
        style:--spritesheet={`url(${base}/img/${bootsSheet})`}
        style:--x={"48px"}
        style:--y={"0"}
        style:--tint={`rgba(${bootTints[0].R},${bootTints[0].G},${bootTints[0].B},${bootTints[0].A})`}
    ></div>
    <div
        class="boots"
        style:--spritesheet={`url(${base}/img/${bootsSheet})`}
        style:--x={"32px"}
        style:--y={"0"}
        style:--tint={`rgba(${bootTints[1].R},${bootTints[1].G},${bootTints[1].B},${bootTints[1].A})`}
    ></div>
    <div
        class="boots"
        style:--spritesheet={`url(${base}/img/${bootsSheet})`}
        style:--x={"0px"}
        style:--y={"0"}
        style:--tint={`rgba(${bootTints[2].R},${bootTints[2].G},${bootTints[2].B},${bootTints[2].A})`}
    ></div>
    <div
        class="boots"
        style:--spritesheet={`url(${base}/img/${bootsSheet})`}
        style:--x={"16px"}
        style:--y={"0"}
        style:--tint={`rgba(${bootTints[3].R},${bootTints[3].G},${bootTints[3].B},${bootTints[3].A})`}
    ></div>
    <!-- END LAYERED TINT -->

    <div
        class="pants"
        style:--spritesheet={`url(${base}/assets/${pantsSheet})`}
        style:--x={`${pantsPosition.x}px`}
        style:--y={`${pantsPosition.y}px`}
        style:--tint={`rgba(${pantsTint.R},${pantsTint.G},${pantsTint.B},${pantsTint.A})`}
    ></div>
    <div
        class="shirt"
        style:--spritesheet={`url(${base}/assets/${shirtSheet})`}
        style:--x={`${shirtPosition.x}px`}
        style:--y={`${shirtPosition.y}px`}
        style:--tint={`rgba(${shirtTint.R},${shirtTint.G},${shirtTint.B},${shirtTint.A})`}
    ></div>

    {#if player.accessory !== -1}
        <!-- START LAYERED TINT -->
        <div
            class="accessory"
            style:--spritesheet={`url(${base}/assets/${accessoriesSheet})`}
            style:--tint={player.accessory !== undefined &&
            AccessoryIsTinted(player.accessory)
                ? `rgba(${hairTint.R},${hairTint.G},${hairTint.B},${hairTint.A})`
                : ""}
            style:--x={`${accessoryPosition.x}px`}
            style:--y={`${accessoryPosition.y}px`}
        ></div>
        <!-- END LAYERED TINT -->
    {/if}

    {#if showHair}
        <div
            class="hair"
            style:--spritesheet={`url(${base}/assets/${hairSheet})`}
            style:--x={`${hairPosition.x}px`}
            style:--y={`${hairPosition.y}px`}
            style:--tint={`rgba(${hairTint.R},${hairTint.G},${hairTint.B},${hairTint.A})`}
        ></div>
    {/if}

    {#if player.hat}
        <div
            class="hat"
            style:--spritesheet={`url(${base}/assets/${hatSheet})`}
            style:--x={`${hatPosition?.x}px`}
            style:--y={`${hatPosition?.y}px`}
        ></div>
    {/if}

    <!-- START LAYERED TINT -->
    <div
        class="arms"
        style:--spritesheet={`url(${base}/img/${armsSheet})`}
        style:--tint={`rgba(${skinTones[2].R},${skinTones[2].G},${skinTones[2].B},${skinTones[2].A})`}
        style:--x={"16px"}
        style:--y={"0"}
    ></div>
    <div
        class="arms"
        style:--spritesheet={`url(${base}/img/${armsSheet})`}
        style:--tint={`rgba(${skinTones[1].R},${skinTones[1].G},${skinTones[1].B},${skinTones[1].A})`}
        style:--x={"32px"}
        style:--y={"0"}
    ></div>
    <div
        class="arms"
        style:--spritesheet={`url(${base}/img/${armsSheet})`}
        style:--tint={`rgba(${skinTones[0].R},${skinTones[0].G},${skinTones[0].B},${skinTones[0].A})`}
        style:--x={"48px"}
        style:--y={"0"}
    ></div>
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
