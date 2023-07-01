<script lang="ts">
    import { AccessoryIsTinted } from '$lib/CharacterColors';

    let character: Player | undefined;
    let skinColor: number = 0;
    let hairStyle: number = 0;
    let shirt: number = 0;
    let pants: number = 0;
    let acc: number = 0;

    Character.character.subscribe((c) => {
        if (!c) return;
        character = c;
        skinColor = c.skinColor + 1;
        hairStyle = c.hair + 1;
        acc = c.accessory + 2;
    });

    import { Character } from '$lib/SaveFile';
    import type { Player } from '$types/save/1.5';
    import Container from '../../Container.svelte';
    import Preview from './Preview.svelte';
</script>

<Container>
    {#if character}
        <div class="wrapper">
            <div class="editor1">
                <Preview isMale={character.isMale} skinColor={character.skinColor} hairStyle={character.hair} acc={character.accessory} />
                <div class="gender">
                    <label>
                        🚹
                        <input type="radio" name="gender" value="male" checked={character && character.isMale} on:click={() => character && (character.isMale = true)} />
                    </label>
                    <label>
                        🚺
                        <input type="radio" name="gender" value="female" checked={character && !character.isMale} on:click={() => character && (character.isMale = false)} />
                    </label>
                </div>
                <div class="appearance">
                    <label>
                        Skin
                        <input type="number" min="1" max="24" bind:value={skinColor} on:change={() => character && (character.skinColor = (skinColor ?? 1) - 1)} />
                    </label>
                    <label>
                        Hair
                        <input type="number" min="1" max="73" bind:value={hairStyle} on:change={() => character && (character.hair = (hairStyle ?? 1) - 1)} />
                    </label>
                    <label>
                        Acc
                        <input type="number" min="1" max="20" bind:value={acc} on:change={() => character && (character.accessory = (acc ?? 1) - 2)} />
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
                        <input type="text" bind:value={character.favoriteThing} />
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

    .gender {
        display: flex;
        gap: 8px;
        justify-content: center;
        width: 100%;
    }

    .gender input {
        appearance: none;
    }

    .gender label {
        border-radius: 4px;
        display: flex;
        justify-content: center;
        align-items: center;
        text-align: center;
        padding-bottom: 0.1em;
        font-size: 1.5em;
        cursor: pointer;
    }

    .gender label:has(input:checked) {
        border: solid 3px #d93703;
    }

    .gender label:has(input:not(:checked)) {
        border: solid 3px #00000000;
    }

    .gender label input {
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
