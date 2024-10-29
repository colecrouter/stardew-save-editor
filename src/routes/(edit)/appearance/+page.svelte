<script lang="ts">
    import { Character } from "$lib/SaveFile";
    import { HexToRGB, RGBToHex } from "$lib/Spritesheet";
    import { Gender, type Player } from "$types/save/1.6";
    import type { Writable } from "svelte/store";
    import Container from "../../Container.svelte";
    import Preview from "./Preview.svelte";

    let character: Player | undefined = $state();
    let skinColor: number = $state(0);
    let hairStyle: number = $state(0);
    let acc: number = $state(0);

    Character.character.subscribe((c) => {
        if (!c) return;
        character = c;
        skinColor = c.skin + 1;
        hairStyle = c.hair + 1;
        acc = c.accessory + 2;
    });

    // Need to rerender when hair/eye color changes, because that doesn't trigger a rerender
    // TODO - Find a better way to do this
    const rerender = () => {
        if (!character) return;
        (Character.character as Writable<Player>).set(character);
    };
</script>

<Container>
    {#if character}
        <div class="wrapper">
            <div class="editor1">
                <Preview
                    gender={character.gender}
                    skinColor={character.skin}
                    hairStyle={character.hair}
                    acc={character.accessory}
                />
                <div class="selector">
                    <label>
                        🚹
                        <input
                            type="radio"
                            name="gender"
                            value="male"
                            checked={character &&
                                character.gender === Gender.Male}
                            onclick={() =>
                                character && (character.gender = Gender.Male)}
                        />
                    </label>
                    <label>
                        🚺
                        <input
                            type="radio"
                            name="gender"
                            value="female"
                            checked={character &&
                                character.gender === Gender.Female}
                            onclick={() =>
                                character && (character.gender = Gender.Female)}
                        />
                    </label>
                </div>
                <div class="appearance">
                    <label>
                        Skin
                        <input
                            type="number"
                            min="1"
                            max="24"
                            bind:value={skinColor}
                            onchange={() =>
                                character &&
                                (character.skin = (skinColor ?? 1) - 1)}
                        />
                    </label>
                    <label>
                        Hair
                        <input
                            type="number"
                            min="1"
                            max="73"
                            bind:value={hairStyle}
                            onchange={() =>
                                character &&
                                (character.hair = (hairStyle ?? 1) - 1)}
                        />
                    </label>
                    <label>
                        Acc
                        <input
                            type="number"
                            min="1"
                            max="20"
                            bind:value={acc}
                            onchange={() =>
                                character &&
                                (character.accessory = (acc ?? 1) - 2)}
                        />
                    </label>
                </div>
            </div>
            <div class="editor2">
                <div>
                    <label>
                        <small>Name</small>
                        <input type="text" bind:value={character.name} />
                    </label>
                </div>
                <div>
                    <label>
                        <small>Farm Name</small>
                        <input type="text" bind:value={character.farmName} />
                    </label>
                    <small>Farm</small>
                </div>
                <div>
                    <label>
                        <small>Favorite Thing</small>
                        <input
                            type="text"
                            bind:value={character.favoriteThing}
                        />
                    </label>
                </div>
                <div>
                    <label>
                        <small>Eye Color</small>
                        <div class="selector">
                            <input
                                type="color"
                                value={RGBToHex(
                                    character?.newEyeColor ?? {
                                        R: 255,
                                        G: 255,
                                        B: 255,
                                        A: 255,
                                        PackedValue: 0,
                                    },
                                )}
                                onchange={(e) => {
                                    if (!character) return;
                                    character.newEyeColor = HexToRGB(
                                        // @ts-expect-error
                                        e.target.value ?? "#000000",
                                    );
                                    rerender();
                                }}
                            />
                        </div>
                    </label>
                </div>
                <div>
                    <label>
                        <small>Hair Color</small>
                        <div class="selector">
                            <input
                                type="color"
                                value={RGBToHex(
                                    character?.hairstyleColor ?? {
                                        R: 255,
                                        G: 255,
                                        B: 255,
                                        A: 255,
                                        PackedValue: 0,
                                    },
                                )}
                                onchange={(e) => {
                                    if (!character) return;
                                    character.hairstyleColor = HexToRGB(
                                        // @ts-expect-error
                                        e.target.value ?? "#000000",
                                    );
                                    rerender();
                                }}
                            />
                        </div>
                    </label>
                </div>
            </div>
        </div>
    {/if}
</Container>

<style>
    .wrapper {
        display: grid;
        grid-template-columns: 1fr 3fr;
        gap: 16px;
    }

    .editor1 {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
    }

    .editor2 label {
        display: grid;
        grid-template-columns: 1fr 3fr;
        align-items: center;
    }

    .editor2 > div {
        display: grid;
        grid-template-columns: 6fr 1fr;
        gap: 8px;
        width: 100%;
        align-items: center;
    }

    .editor2 {
        align-items: start;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    input {
        text-align: center;
    }

    .selector {
        display: flex;
        flex-direction: row;
        justify-content: center;
    }

    .selector input {
        appearance: none;
    }

    .selector label {
        border-radius: 4px;
        display: flex;
        justify-content: center;
        align-items: center;
        text-align: center;
        padding-bottom: 0.1em;
        font-size: 1.5em;
        cursor: pointer;
        /* Beef up the text shadow a little bit, some emojis might blend into the bg too much */
        text-shadow: -0.05em 0.05em 0.1em rgba(0, 0, 0, 0.6);
    }

    .selector label:has(input:checked) {
        border: solid 3px #d93703;
    }

    .selector label:has(input:not(:checked)) {
        border: solid 3px #00000000;
    }

    .selector label input {
        position: absolute;
    }

    .appearance {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
    }

    .appearance label {
        display: flex;
        justify-content: space-between;
    }
</style>
