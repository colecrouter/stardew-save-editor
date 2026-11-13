<script lang="ts">
	import { dynamicAsset } from "$lib/ui/dynamicAsset.ts";
	import { seasonName, type GameDate } from "../../calendar.ts";
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

	<div class="weekdays" aria-hidden="true">
		{#each weekdays as day}
			<span>{day}</span>
		{/each}
	</div>

	<div class="days" role="group" aria-label="Day of month">
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

				<span class="markers" aria-hidden="true">
					{#each occasions as occasion}
						{@const portrait = occasion.portrait
							? dynamicAsset(`assets/portraits/${occasion.portrait}.png`)
							: undefined}

						{#if portrait}
							<span
								class="portrait"
								style:background-image={`url('${portrait}')`}
							></span>
						{:else}
							<svg
								class:locked={occasion.locked}
								viewBox="0 0 24 24"
								width="24"
								height="24"
							>
								{#if occasion.kind === "bookseller"}
									<path
										d="M3 4h8l1 2 1-2h8v15h-8l-1 2-1-2H3z"
										fill="#b66a43"
										stroke="#623b2c"
										stroke-width="2"
									/>
									<path
										d="M12 6v13M5 7h4M15 7h4"
										stroke="#fff2ce"
										stroke-width="2"
									/>
								{:else if occasion.kind === "derby"}
									<path
										d="M3 12q8-11 15 0-7 11-15 0m15 0 5-5v10z"
										fill="#459bbb"
										stroke="#2e5365"
										stroke-width="2"
									/>
								{:else}
									<path
										d="M5 22V2m0 2h16l-5 5 5 5H5"
										fill="#a967b6"
										stroke="#684471"
										stroke-width="2"
									/>
								{/if}
							</svg>
						{/if}
					{/each}
				</span>
			</button>
		{/each}
	</div>
</div>

<div class="day-detail" aria-live="polite">
	<strong>{seasonName(date.season)} {date.day}</strong>

	{#if !eventsAvailable}
		<p>Calendar events are unavailable until the year is valid.</p>
	{:else if selected.length}
		<ul>
			{#each selected as event}
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
	svg {
		flex: none;
		image-rendering: pixelated;
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
		.markers svg {
			width: 20px;
			height: 20px;
		}
		.weekdays span {
			font-size: 21px;
		}
	}
</style>
