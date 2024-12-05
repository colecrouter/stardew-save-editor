<script lang="ts">
    import { goto } from "$app/navigation";
    import { base } from "$app/paths";
    import { getSaveManager } from "$lib/SaveManager.svelte";

    interface Props {
        children: import("svelte").Snippet;
    }

    let { children }: Props = $props();

    $effect(() => {
        const saveManager = getSaveManager();
        if (saveManager.save) {
            goto(`${base}/inventory`);
        }
    });
</script>

{@render children()}
