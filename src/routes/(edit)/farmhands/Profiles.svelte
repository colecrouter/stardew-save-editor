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
    import Character from "../appearance/Character.svelte";

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
        <div class="outer">
            <div class="inner">
                <div class="content">
                    <div class="left">
                        <div class="number">
                            {i + 1}.
                        </div>
                        <div class="character">
                            <Character player={farmer} />
                        </div>
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
                                <label for="money-earned" hidden
                                    >Money Earned</label
                                >
                                <span
                                    id="money-earned"
                                    aria-label="Money Earned"
                                >
                                    💵 {moneyEarned}
                                </span>
                            </div>
                            <div class="stat">
                                <label for="time-played" hidden
                                    >Time Played</label
                                >
                                <span id="time-played" aria-label="Time Played">
                                    🕒 {hoursPlayed}:{minutesPlayed}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
{/each}

<style>
    .wrapper {
        border: 1px solid #6f3b31;
        border-radius: 2px;
    }

    .outer {
        border: 2px solid #fff;
    }

    .inner {
        border: 2px solid #9c613b;
    }

    .content {
        padding: 1rem;
        margin: -2px;
        border: 2px solid #9c613b;
        border-radius: 10px;
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

    .character {
        max-height: 60px;
        transform: translateY(-10px);
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

    .farm-name {
        font-style: italic;
    }
</style>
