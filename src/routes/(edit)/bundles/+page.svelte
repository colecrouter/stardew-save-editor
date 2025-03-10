<script lang="ts">
    import { getSaveManager } from "$lib/SaveManager.svelte";
    import { MailFlag } from "$lib/proxies/mail";
    import UiContainer from "$lib/ui/UIContainer.svelte";
    import Bundle from "./Bundle.svelte";

    const save = getSaveManager().save;
    const bundles = save?.communityBundles;
    if (!save || !bundles) throw new Error("No save data found");

    // Woohoo, side effects!
    // I can't think of a good way to implement this in the logic without making it more complex
    // TODO fix
    $effect(() => {
        if (
            bundles.bundles
                .filter((b) => b.id >= 23 && b.id <= 26)
                .every((b) => b.completed)
        ) {
            console.log(
                bundles.bundles.filter((b) => b.id >= 23 && b.id <= 26),
            );
            for (const player of save.players) {
                if (!player.mailReceived.has(MailFlag.ccVault)) {
                    player.mailReceived = player.mailReceived.add(
                        MailFlag.ccVault,
                    );
                }
            }
        } else {
            for (const player of save.players) {
                if (player.mailReceived.has(MailFlag.ccVault)) {
                    const cloned = new Set(player.mailReceived);
                    cloned.delete(MailFlag.ccVault);
                    player.mailReceived = cloned;
                }
            }
        }
        // TODO add more bundles
        // TODO eww
    });
</script>

<UiContainer>
    <h2>Under Construction 🏗️</h2>

    {#each bundles.bundles as bundle}
        <Bundle {bundle} />
    {/each}
</UiContainer>
