<script lang="ts">
	import { asset } from "$app/paths";
	import AtlasRegion from "$lib/ui/AtlasRegion.svelte";
	import { dynamicAsset } from "$lib/ui/dynamicAsset.ts";

	import { type GameDate, seasonName } from "../../calendar.ts";
	import type { CalendarEvent } from "../calendar-events.ts";

	let {
		date,
		saved,
		events,
		disabled,
		select,
		yearLabel,
		eventsAvailable = true,
	}: {
		yearLabel?: string;
		eventsAvailable?: boolean;
		date: GameDate;
		saved: GameDate;
		events: readonly CalendarEvent[];
		disabled: boolean;
		select: (day: number) => void;
	} = $props();
	const selected = $derived(events.filter((event) => event.day === date.day));
	const weekdays = ["M", "T", "W", "Th", "F", "Sa", "Su"];
	const savedHere = $derived(
		saved.year === date.year && saved.season === date.season,
	);
</script>

<!-- Every season starts on Monday. Day buttons stage the date only; event labels
     are also exposed outside hover so touch and keyboard users get the same info. -->
<div class="month-paper">
	<h2>
		{seasonName(date.season)}
		<span>Year {yearLabel ?? date.year}</span>
	</h2>

	<div
		class="weekdays"
		aria-hidden="true"
	>
		{#each weekdays as day (day)}
			<span>{day}</span>
		{/each}
	</div>

	<div
		class="days"
		role="group"
		aria-label="Day of month"
	>
		{#each Array.from({ length: 28 }, (_, index) => index + 1) as day (day)}
			{@const occasions = events.filter((event) => event.day === day)}
			{@const summary = occasions.map((event) => event.label).join(", ")}
			<button
				type="button"
				aria-label={`${day}${summary ? `: ${summary}` : ""}`}
				aria-pressed={date.day === day}
				aria-current={savedHere && saved.day === day ? "date" : undefined}
				{disabled}
				title={summary || undefined}
				onclick={() => select(day)}
			>
				<span class="day-number">{day}</span>

				<span
					class="markers"
					aria-hidden="true"
				>
					{#each occasions as occasion (occasion)}
						{@const portrait = occasion.portrait
							? dynamicAsset(`assets/portraits/${occasion.portrait}.png`)
							: undefined}

						{#if portrait}
							<span
								class="portrait"
								style:background-image={`url('${portrait}')`}
							></span>
						{:else}
							<span
								class="event-marker"
								class:locked={occasion.locked}
							>
								{#if occasion.kind === "bookseller"}
									<!-- Stardew Valley Almanac: Objects_2 index 90, eight 16px columns. -->
									<AtlasRegion
										atlas={{
											url: asset("assets/Objects_2.png"),
											width: 128,
											height: 320,
										}}
										rect={{ x: 32, y: 176, width: 16, height: 16 }}
									/>
								{:else if occasion.kind === "derby"}
									<!-- Rainbow Trout: springobjects index 138, twenty-four 16px columns.
									     One fish marks both derbies without implying a specific required catch. -->
									<AtlasRegion
										atlas={{
											url: asset("assets/springobjects.png"),
											width: 384,
											height: 624,
										}}
										rect={{ x: 288, y: 80, width: 16, height: 16 }}
									/>
								{:else}
									<!-- Billboard.draw's first 14×12 festival flag frame stays still here.
									     It also marks birthdays without a portrait; text names the occasion. -->
									<span class="festival-marker">
										<AtlasRegion
											atlas={{
												url: asset("assets/Billboard.png"),
												width: 338,
												height: 512,
											}}
											rect={{ x: 1, y: 398, width: 14, height: 12 }}
										/>
									</span>
								{/if}
							</span>
						{/if}
					{/each}
				</span>
			</button>
		{/each}
	</div>
</div>

<div
	class="day-detail"
	aria-live="polite"
>
	<strong>{seasonName(date.season)} {date.day}</strong>

	{#if !eventsAvailable}
		<p>Calendar events are unavailable until the year is valid.</p>
	{:else if selected.length}
		<ul>
			{#each selected as event (event)}
				<li>{event.label}{event.locked ? " — unavailable" : ""}</li>
			{/each}
		</ul>
	{:else}
		<p>No known calendar events.</p>
	{/if}
</div>

<p class="calendar-key">
	Red corner: saved date. Outlined square: selected date.
</p>

<style>
	.month-paper {
		background: #fbefc9;
		color: #3a291b;
		border: 2px solid #765437;
	}
	h2 {
		text-align: center;
		font:
			30px/1.3 "VT323",
			monospace;
		margin: 0;
		padding: 12px 8px;
	}
	h2 span {
		margin-left: 12px;
		font-size: 21px;
		color: #775834;
	}
	.weekdays,
	.days {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
	}
	.weekdays {
		border-top: 2px solid #765437;
		border-bottom: 2px solid #765437;
	}
	.weekdays span {
		text-align: center;
		font-size: 25px;
		padding-block: 3px;
	}
	.days button {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		justify-content: space-between;
		min-width: 0;
		min-height: 92px;
		background: transparent;
		border: 0;
		border-right: 1px solid #98774f;
		border-bottom: 1px solid #98774f;
		color: inherit;
		font: inherit;
		cursor: pointer;
		padding: 4px;
	}
	.days button:nth-child(7n) {
		border-right: 0;
	}
	.days button:nth-last-child(-n + 7) {
		border-bottom: 0;
	}
	.days button[aria-pressed="true"] {
		background: #f8d697;
		box-shadow: inset 0 0 0 3px #77502b;
	}
	.days button[aria-current="date"]::after {
		content: "";
		position: absolute;
		right: 0;
		top: 0;
		border-top: 12px solid #b74537;
		border-left: 12px solid transparent;
	}
	.days button:focus-visible {
		outline: 3px solid #176fb4;
		outline-offset: -3px;
		z-index: 1;
	}
	.days button:disabled {
		cursor: default;
		opacity: 0.6;
	}
	.day-number {
		text-align: left;
		font-size: 24px;
		line-height: 1;
	}
	.markers {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		justify-content: center;
		gap: 2px;
		min-height: 32px;
	}
	.portrait {
		display: block;
		width: 32px;
		height: 32px;
		background-size: 200% auto;
		image-rendering: pixelated;
	}
	.event-marker {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		flex: none;
	}
	.festival-marker {
		/* Match the book/fish's 2× source scale without stretching the flag's aspect. */
		width: 28px;
		height: 24px;
	}
	.locked {
		opacity: 0.45;
	}
	.day-detail {
		padding: 12px 0;
		min-height: 90px;
	}
	.day-detail strong {
		font-size: 22px;
	}
	.day-detail p {
		margin: 4px 0 0;
		color: #694621;
	}
	.day-detail ul {
		margin: 4px 0 0;
		padding-left: 22px;
	}
	.calendar-key {
		font-size: 17px;
		color: #694621;
		margin: 0 0 16px;
	}
	/* Desktop has room for event markers side by side. Reduce spare vertical
	   space so the staged date's Apply controls fit beneath the four-week grid.
	   Keep natural growth for days with several markers or longer event details. */
	@media (min-width: 1051px) {
		h2 {
			padding-block: 6px;
		}
		.days button {
			min-height: 64px;
		}
		.day-detail {
			min-height: 64px;
			padding-block: 8px;
		}
		.calendar-key {
			margin-bottom: 10px;
		}
	}
	@media (max-width: 600px) {
		.days button {
			min-height: 72px;
			padding: 3px;
		}
		.day-number {
			font-size: 21px;
		}
		.portrait {
			width: 24px;
			height: 24px;
		}
		.markers {
			min-height: 24px;
		}
		.event-marker {
			width: 24px;
			height: 24px;
		}
		.festival-marker {
			width: 21px;
			height: 18px;
		}
		.weekdays span {
			font-size: 21px;
		}
	}
</style>
