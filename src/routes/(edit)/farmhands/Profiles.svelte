<script lang="ts" module>
    const seasons = new Map([
        [0, "Spring"],
        [1, "Summer"],
        [2, "Fall"],
        [3, "Winter"],
    ]);
</script>

<script lang="ts">
    import type { Farmer } from "$lib/proxies/Farmer";
    import CharacterPreview from "../appearance/CharacterPreview.svelte";

    interface Props {
        farmers: Farmer[];
    }

    let { farmers }: Props = $props();
</script>

{#each farmers as farmer, i}
    {@const hoursPlayed = Math.floor(
        farmer.raw.millisecondsPlayed / 1000 / 60 / 60,
    )}
    {@const minutesPlayed = Math.floor(
        (farmer.raw.millisecondsPlayed / 1000 / 60) % 60,
    )}
    {@const moneyEarned = farmer.raw.totalMoneyEarned}
    {@const season = seasons.get(farmer.raw.seasonForSaveGame)}
    {@const day = farmer.raw.dayOfMonthForSaveGame}
    {@const year = farmer.raw.yearForSaveGame}
    {@const farmName = farmer.raw.farmName}

    <div class="wrapper">
        <div class="inner">
            <div class="content">
                <div class="left">
                    <div class="number">
                        {i + 1}.
                    </div>
                    <CharacterPreview player={farmer} />
                    <div class="details">
                        <h2 class="name">
                            {farmer.name}
                        </h2>
                        <div class="date">
                            Day {day} of {season}, Year {year}
                        </div>
                    </div>
                </div>
                <div class="right">
                    <div class="farm-name">
                        {farmName} Farm
                    </div>
                    <div class="stats">
                        <div class="stat">
                            <label for="money-earned" hidden>Money Earned</label
                            >
                            <span id="money-earned" aria-label="Money Earned">
                                🪙 {moneyEarned}
                            </span>
                        </div>
                        <div class="stat">
                            <label for="time-played" hidden>Time Played</label>
                            <span id="time-played" aria-label="Time Played">
                                🕒 {hoursPlayed}:{minutesPlayed}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
{/each}

<style>
    .content {
        display: flex;
        justify-content: space-between;
    }

    .left {
        display: flex;
        justify-content: stretch;
    }

    .number {
        font-size: large;
        font-weight: bold;
        margin-right: 1em;
    }

    .details {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        margin-left: 1em;
    }

    .right {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: flex-end;
    }

    .details > h2 {
        padding: 0;
        font-size: large;
    }

    .stat {
        display: inline-block;
    }
</style>
