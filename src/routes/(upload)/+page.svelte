<script lang="ts">
    import { goto } from '$app/navigation';
    import { FileName, SaveGame } from '$lib/SaveFile';
    import Container from '../Container.svelte';

    let submit: HTMLInputElement;

    const handle = async (event: Event) => {
        const formData = new FormData(event.target as HTMLFormElement);
        const filename = (formData.get('file') as File).name;

        const res = await fetch('/api/toJSON', {
            method: 'POST',
            body: formData,
        });

        if (!res.ok) {
            let text = '';
            switch (res.status) {
                case 400:
                case 500:
                    text = await res.text();
                default:
                    text = 'Unknown error';
                    break;
            }
            return alert(text);
        }

        const json = (await res.json()) as SaveFile;
        SaveGame.set(json);
        FileName.set(filename);
        goto('/inventory');
    };
</script>

<Container>
    <form on:submit|preventDefault={handle} method="POST">
        <input
            type="file"
            accept=""
            name="file"
            required
            on:change={() => {
                return submit.click();
            }} />
        <input type="submit" value="Upload" bind:this={submit} hidden />
        <small>
            Default save locations:
            <ul>
                <li><span class="noselect">Windows: </span><code>%appdata%\StardewValley\Saves</code></li>
                <li><span class="noselect">Mac: </span><code>~/Library/Application Support/StardewValley/Saves</code></li>
                <li><span class="noselect">Linux: </span><code>~/.config/StardewValley/Saves</code></li>
            </ul>

            <div class="warning">Backup your save file. Invalid save files may break the game.</div>
        </small>
    </form>
</Container>

<style>
    form {
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    /* Big striped Drag and Drop File Upload */
    input[type='file'] {
        position: relative;
        border: 2px dashed #8e3d04;
        border-radius: 5px;
        width: 400px;
        height: 100%;
        padding: 54px 0;
        font-size: 20px;
        color: #8e3d04;
        margin: 20px auto;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0;
    }

    input[type='file']:focus {
        outline: none;
    }

    input[type='file']:hover {
        cursor: pointer;
    }

    input[type='file']::file-selector-button {
        display: none;
    }

    input[type='file']::after {
        content: 'Drag and Drop or Click';
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        color: #8e3d04;
    }

    ul {
        list-style: none;
        padding: 0;
    }

    li {
        margin-top: 0.3em;
    }

    .noselect {
        user-select: none;
    }

    .warning {
        background-color: rgba(255, 0, 0, 0.35);
        border-left: solid 4px rgba(255, 0, 0, 0.7);
        font-weight: bold;
        padding: 2px;
        font-size: 1.1em;
    }
</style>
