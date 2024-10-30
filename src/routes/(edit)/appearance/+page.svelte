<script lang="ts">
    import { saveManager } from "$lib/SaveFile.svelte";
    import { HexToRGB, RGBToHex } from "$lib/Spritesheet";
    import { Gender, type Player } from "$types/save/1.6";
    import Container from "../../Container.svelte";
    import Preview from "./Preview.svelte";

    const textFields = [
        ["Name", "name"],
        ["Farm Name", "farmName"],
        ["Favorite Thing", "favoriteThing"],
    ] satisfies [string, keyof Player][];

    const colorFields = [
        ["Eye Color", "newEyeColor"],
        ["Hair Color", "hairstyleColor"],
    ] satisfies [string, keyof Player][];

    // Label, key, min, max
    const numberFields = [
        ["Skin", "skin", 0, 23],
        ["Hair", "hair", 0, 72],
        ["Acc", "accessory", -1, 19],
    ] satisfies [string, keyof Player, number, number][];

    let player = saveManager.player;
</script>

<Container>
    {#if player}
        <div class="wrapper">
            <div class="editor1">
                <Preview {player} />
                <div class="selector">
                    <label>
                        🚹
                        <input
                            type="radio"
                            name="gender"
                            value="male"
                            checked={player && player.gender === Gender.Male}
                            onclick={() =>
                                player && (player.gender = Gender.Male)}
                        />
                    </label>
                    <label>
                        🚺
                        <input
                            type="radio"
                            name="gender"
                            value="female"
                            checked={player && player.gender === Gender.Female}
                            onclick={() =>
                                player && (player.gender = Gender.Female)}
                        />
                    </label>
                </div>
                <div class="appearance">
                    {#each numberFields as [label, key, min, max]}
                        <label>
                            {label}
                            <input
                                type="number"
                                {min}
                                {max}
                                bind:value={player[key]}
                            />
                        </label>
                    {/each}
                </div>
            </div>
            <div class="editor2">
                {#each textFields as [label, key]}
                    <div>
                        <label>
                            <small>{label}</small>
                            <input type="text" bind:value={player[key]} />
                        </label>
                    </div>
                {/each}
                {#each colorFields as [label, key]}
                    <div>
                        <label>
                            <small>{label}</small>
                            <div class="selector">
                                <input
                                    type="color"
                                    value={RGBToHex(
                                        player[key] ?? {
                                            R: 255,
                                            G: 255,
                                            B: 255,
                                            A: 255,
                                            PackedValue: 0,
                                        },
                                    )}
                                    onchange={(e) => {
                                        if (!player) return;
                                        player[key] = HexToRGB(
                                            // @ts-expect-error
                                            e.target.value ?? "#000000",
                                        );
                                    }}
                                />
                            </div>
                        </label>
                    </div>
                {/each}
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
