<script lang="ts">
    import { BackupManager } from "$lib/Backups";
    import Container from "../../Container.svelte";
    import Backup from "./Backup.svelte";

    const backups = BackupManager.backups;
</script>

<Container>
    <div class="wrapper">
        {#if $backups.length > 0}
            {#each $backups as backup, i}
                <div class="line">
                    <Backup
                        {backup}
                        deleteFunc={() => {
                            BackupManager.splice(i, 1);
                        }}
                    />
                </div>
            {/each}
        {:else}
            <h2>No Backups Found</h2>
        {/if}
    </div>
</Container>

<style>
    .wrapper {
        overflow-y: scroll;
        height: 20rem;
    }

    .line {
        padding: 4px 0;
        border-bottom: 2px solid #000;
    }
</style>
