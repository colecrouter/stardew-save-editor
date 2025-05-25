<script lang="ts">
    import { getSaveManager } from "$lib/SaveManager.svelte";
    import { MailFlag } from "$lib/proxies/mail";
    import UiCheckbox from "$lib/ui/UICheckbox.svelte";
    import UiContainer from "$lib/ui/UIContainer.svelte";
    import Bundle from "./Bundle.svelte";
    import JojaBundles from "./JojaBundles.svelte";

    const save = getSaveManager().save;
    const bundles = save?.communityBundles;
    const cc = save?.locations.find((l) => l.raw.name === "CommunityCenter");
    if (!save || !bundles) throw new Error("No save data found");

    // Woohoo, side effects!
    // I can't think of a good way to implement this in the logic without making it more complex
    $effect(() => {
        bundles.applySideEffects(save);
    });

    let hasJojaMembership = $derived(
        save?.players?.some((player) =>
            player.mailReceived.has(MailFlag.JojaMember),
        ),
    );

    function enableJojaMembership() {
        for (const player of save?.players ?? []) {
            const updated = new Set(player.mailReceived);
            updated.add(MailFlag.JojaMember);
            player.mailReceived = updated;
        }
    }

    function disableJojaMembership() {
        for (const player of save?.players ?? []) {
            const updated = new Set(player.mailReceived);
            updated.delete(MailFlag.JojaMember);
            player.mailReceived = updated;
        }
    }
</script>

<UiContainer>
    <div class="warning">
        <h2>Under Construction 🏗️</h2>
        <p>Parts of this page are still being worked on.</p>
    </div>

    <h1>Community Bundles</h1>

    <!-- Enable or disable Joja Membership -->
    <label class="member-menu">
        <UiCheckbox
            type="checkbox"
            checked={hasJojaMembership}
            onchange={() => {
                if (hasJojaMembership) {
                    disableJojaMembership();
                } else {
                    enableJojaMembership();
                }
            }}
        />
        Enable Joja Membership
    </label>

    {#if hasJojaMembership}
        {#if cc}
            <JojaBundles {bundles} />
        {/if}
    {:else}
        <div class="wrapper">
            {#each bundles.bundles as bundle}
                <Bundle {bundle} />
            {/each}
        </div>
    {/if}
</UiContainer>

<style>
    .member-menu {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 1rem;
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

    .wrapper {
        height: 320px;
        overflow-y: auto;
    }
</style>
