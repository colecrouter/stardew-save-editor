<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { FileName, SaveConverter, SaveGame } from '$lib/SaveFile';
  import Container from '../Container.svelte';

  let submit: HTMLInputElement;
  let files: FileList;

  const handle = async () => {
    const file = files[0];
    const formData = new FormData();
    formData.append('file', file);

    let json: SaveFile;
    try {
      json = await SaveConverter.toJSON(file);
    } catch (e) {
      alert((e as Error).message);
      return;
    }

    // Save is good, back it up
    const { BackupManager: Backups } = await import('$lib/Backups');
    Backups.unshift(file);

    SaveGame.set(json);
    FileName.set(file.name);
    goto(base + '/inventory');
  };
</script>

<Container>
  <form on:submit|preventDefault={handle} method="POST">
    <input
      type="file"
      accept=""
      name="file"
      required
      bind:files
      on:change={() => {
        return submit.click();
      }} />
    <input type="submit" value="Upload" bind:this={submit} hidden />
    <small>
      Default save locations:
      <ul>
        <li>
          <span class="noselect">Windows: </span><code>%appdata%\StardewValley\Saves</code>
        </li>
        <li>
          <span class="noselect">Mac: </span><code>~/Library/Application Support/StardewValley/Saves</code>
        </li>
        <li>
          <span class="noselect">Linux: </span><code>~/.config/StardewValley/Saves</code>
        </li>
      </ul>

      <div class="warning">
        <p>
          <strong>Always backup your save file. Corrupt save files may break the game.</strong> You take full responsibility by using this tool.
        </p>
      </div>

      <p>You can access temporary backups of your saves by clicking the CD icon.</p>
      <p>
        If you find a problem, please report it <a href="https://github.com/colecrouter/stardew-save-editor/issues">on GitHub</a>.
      </p>
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
  }

  .warning > * {
    padding: 0.2rem;
    padding-left: 0.5rem;
    margin-block-start: 0.2em;
    margin-block-end: 0.2em;
  }
</style>
