<script lang="ts">
    import { getSaveManager } from "$lib/SaveManager.svelte";
    import { Color } from "$lib/proxies/Color";
    import type { Farmer } from "$lib/proxies/Farmer";
    import UiContainer from "$lib/ui/UIContainer.svelte";
    import UiInput from "$lib/ui/UIInput.svelte";
    import { Gender } from "$types/save";
    import Preview from "./CharacterPreview.svelte";

    const textFields = [
        ["Name", "name"],
        ["Farm Name", "farmName"],
        ["Favorite Thing", "favoriteThing"],
    ] satisfies [string, keyof Farmer][];

    const colorFields = [
        ["Eye Color", "eyeColor"],
        ["Hair Color", "hairColor"],
    ] satisfies [string, keyof Farmer][];

    // Label, key, min, max
    const numberFields = [
        ["Skin", "skin", 0, 23],
        ["Hair", "hairstyle", 0, 72],
        ["Acc", "accessory", -1, 29],
    ] satisfies [string, keyof Farmer, number, number][];

    const save = getSaveManager().save;
    if (!save) throw new Error("No player data found");
</script>

<UiContainer>
    <div class="wrapper">
        <div class="editor1">
            <Preview player={save.player} />
            <div class="selector">
                <label>
                    🚹
                    <input
                        type="radio"
                        name="gender"
                        value="male"
                        checked={save.player &&
                            save.player.gender === Gender.Male}
                        onclick={() =>
                            save.player && (save.player.gender = Gender.Male)}
                    />
                </label>
                <label>
                    🚺
                    <input
                        type="radio"
                        name="gender"
                        value="female"
                        checked={save.player &&
                            save.player.gender === Gender.Female}
                        onclick={() =>
                            save.player && (save.player.gender = Gender.Female)}
                    />
                </label>
            </div>
            <div class="appearance">
                {#each numberFields as [label, key, min, max]}
                    <label>
                        {label}
                        <UiInput
                            type="number"
                            data-testid={`appearance-${key}`}
                            {min}
                            {max}
                            bind:value={save.player[key]}
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
                        <UiInput
                            type="text"
                            data-testid={`appearance-${key}`}
                            bind:value={save.player[key]}
                            data-sentry-mask
                        />
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
                                data-testid={`appearance-${key}`}
                                value={save.player[key].toHex()}
                                onchange={(e) => {
                                    save.player[key] = new Color(
                                        // @ts-expect-error
                                        e.target.value ?? "#0000FF",
                                    );
                                    // console.log(save.player[key].toHex());
                                }}
                            />
                        </div>
                    </label>
                </div>
            {/each}
        </div>
    </div>
</UiContainer>

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

    .editor2 :global(input) {
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
