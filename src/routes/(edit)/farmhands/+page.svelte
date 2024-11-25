<script lang="ts">
    import { saveManager } from "$lib/save.svelte";
    import UiContainer from "$lib/ui/UIContainer.svelte";
    import Profiles from "./Profiles.svelte";

    const save = saveManager.save;
    if (!save) throw new Error("No player data found");
</script>

<UiContainer>
    <Profiles farmers={save.players} />
</UiContainer>

<style>
</style>
