<script lang="ts">
    import { getSaveManager } from "$lib/SaveManager.svelte";
    import type { Building } from "$lib/proxies/Building.svelte";
    import { GameLocation } from "$lib/proxies/GameLocation";
    import UiCheckbox from "$lib/ui/UICheckbox.svelte";
    import UiContainer from "$lib/ui/UIContainer.svelte";
    import UiContainerSmall from "$lib/ui/UIContainerSmall.svelte";
    import UiInput from "$lib/ui/UIInput.svelte";
    import UiSelect from "$lib/ui/UISelect.svelte";
    import BuildingSprite from "../../inventory/BuildingSprite.svelte";

    let save = getSaveManager().save;
    if (!save) throw new Error("No save data found");
    let locations = $derived(save.locations);

    const properties = [
        ["Upgrade Level", "upgradeLevel", 0, 3],
        ["Repaired", "repaired"],
    ] as [string, keyof Building, number | undefined, number | undefined][];
</script>

<UiContainer>
    <h1>Buildings</h1>

    {#each Object.keys(locations) as _, i}
        {@render location(i)}
    {/each}
</UiContainer>

{#snippet building(location: GameLocation, key: number)}
    {@const building = location.buildings?.[key]}
    <div class="container">
        {#if building}
            <UiContainerSmall>
                <div class="bg-wrapper">
                    <div class="bg">
                        <BuildingSprite {building} />
                    </div>
                </div>
            </UiContainerSmall>
            <div>
                <h3>{building.name}</h3>
                <div class="options">
                    {#if building.location?.animals}
                        {@const max = building.data?.maxOccupants ?? "??"}
                        {@const animals = building.location.animals.length}
                        <small>
                            <span>Animals</span>
                            <var>{animals}/{max}</var>
                        </small>
                    {/if}

                    {#if building.farmBuildingUpgrades.length > 1}
                        <UiSelect
                            bind:value={building.upgradeLevel!}
                            options={building.farmBuildingUpgrades.map(
                                (upgrade) => ({
                                    label: upgrade ?? "",
                                    value: upgrade ?? "",
                                }),
                            )}
                        />
                    {/if}

                    {#each properties as [label, prop, min, max]}
                        {#if building[prop] !== undefined}
                            <label>
                                <small>{label}</small>
                                {#if typeof building[prop] === "number"}
                                    <UiInput
                                        bind:value={building[prop]}
                                        type="number"
                                        {min}
                                        {max}
                                    />
                                {:else if typeof building[prop] === "boolean"}
                                    <UiCheckbox bind:checked={building[prop]} />
                                {/if}
                            </label>
                        {/if}
                    {/each}
                </div>
            </div>
        {/if}
    </div>
{/snippet}

{#snippet location(key: number)}
    {@const location = locations[key]}
    {#if location?.buildings.length}
        <h2>{location.name}</h2>
        {#each location.buildings ?? [] as _, i}
            {@render building(location, i)}
        {/each}
    {/if}
{/snippet}

<style>
    .bg-wrapper {
        width: 100%;
        display: flex;
        justify-content: center;
    }

    .bg {
        background-image: linear-gradient(
                rgba(0, 0, 0, 0.5),
                rgba(0, 0, 0, 0.5)
            ),
            url(/img/wallpaper.jpg);
        background-size: 256px;
        background-position: bottom left;
        padding: 6px;
        width: 56px;
        height: 56px;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .container {
        display: flex;
        padding-bottom: 12px;
        gap: 8px;
        padding-left: 12px;
    }

    .container > div:nth-child(2) {
        width: 100%;
    }

    label {
        display: flex;
        gap: 4px;
        align-items: center;
        padding-right: 8px;
    }
</style>
