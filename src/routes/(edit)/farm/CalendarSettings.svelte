<script lang="ts">
	import { asset } from "$app/paths";
	import {
		calendarFestivalOn,
		DAYS_PER_SEASON,
		formatDate,
		MAX_YEAR,
		SEASONS,
		seasonName,
		WEEKDAYS,
	} from "$lib/calendar";
	import type { Calendar } from "$lib/proxies/Calendar.svelte";
	import UiInput from "$lib/ui/UIInput.svelte";
	import UiSelect from "$lib/ui/UISelect.svelte";
	import { Season } from "$types/save";

	interface Props {
		calendar: Calendar;
	}

	let { calendar }: Props = $props();

	const days = Array.from({ length: DAYS_PER_SEASON }, (_, i) => i + 1);
	// Every season starts on a Monday
	const weekdays = [...WEEKDAYS.slice(1), ...WEEKDAYS.slice(0, 1)];

	const greenRainDay = $derived(calendar.greenRainDay());
	const tomorrow = $derived(calendar.tomorrowDate);

	// A typed year applies on change (Enter, or leaving the field), not on
	// every keystroke, so typing "15" doesn't move the date to Year 1 first
	let yearDraft = $state<number>();
	const applyYear = () => {
		const year = yearDraft;
		yearDraft = undefined;
		if (year !== undefined) calendar.year = year;
	};

	/** What's on a day of the shown season, if anything */
	const dayNote = (day: number) => {
		const festival = calendarFestivalOn({ season: calendar.season, day });
		if (festival) return festival.name;
		if (calendar.season === Season.Summer && day === greenRainDay)
			return "Green rain";
		if (calendar.season === Season.Summer && day % 13 === 0) return "Storm";
		return undefined;
	};

	// Nothing else to pick when the day's weather is fixed
	const onlyChoice = (
		options: { id: string; allowed: boolean }[],
		current: string,
	) => options.every((o) => !o.allowed || o.id === current);

	/** Apply a choice, or show why it can't be made and put the select back */
	const choose = (
		select: HTMLSelectElement,
		set: (value: string) => void,
		current: () => string,
	) => {
		select.setCustomValidity("");
		try {
			set(select.value);
		} catch (e) {
			select.setCustomValidity(e instanceof Error ? e.message : String(e));
			select.reportValidity();
		}
		select.value = current();
	};

	// The weather icons beside the clock: Cursors.png (317 + 12 * index, 421), 12x8
	// (Game1.updateWeatherIcon). Green rain's icon isn't in that sheet, so it's
	// the rain icon tinted green.
	const sheet = `url(${asset("/assets/Cursors.png")})`;
	const iconIndex = (weather: string, season: Season) => {
		switch (weather) {
			case "Wedding":
				return 0;
			case "Festival":
				return 1;
			case "Sun":
				return 2;
			case "Wind":
				return season === Season.Spring
					? 3
					: season === Season.Fall
						? 6
						: season === Season.Winter
							? 7
							: 2;
			case "Rain":
			case "GreenRain":
				return 4;
			case "Storm":
				return 5;
			case "Snow":
				return 7;
			default:
				return undefined;
		}
	};
</script>

{#snippet weatherIcon(weather: string, season: Season)}
	{@const index = iconIndex(weather, season)}
	<span
		class="weather-icon"
		class:green={weather === "GreenRain"}
		style:--sheet={index === undefined ? undefined : sheet}
		style:background-position={`-${317 + 12 * (index ?? 0)}px -421px`}
		aria-hidden="true"
	></span>
{/snippet}

<h3>Date</h3>
<div class="settings">
	<label>
		Year
		<!-- UiInput only passes on years that fit min, max and step, and puts
		the current year back (defaultValue) if the field is left empty -->
		<UiInput
			type="number"
			min="1"
			max={MAX_YEAR}
			step="1"
			defaultValue={calendar.year}
			bind:value={() => yearDraft ?? calendar.year,
			(v) => {
				const year = v === null ? undefined : Number(v);
				yearDraft = year === calendar.year ? undefined : year;
			}}
			onchange={applyYear}
			data-testid="calendar-year"
		/>
	</label>
	<label>
		Season
		<UiSelect
			value={calendar.season}
			onchange={(e) => (calendar.season = e.currentTarget.value as Season)}
			data-testid="calendar-season"
		>
			{#each SEASONS as season (season)}
				<option value={season}>{seasonName(season)}</option>
			{/each}
		</UiSelect>
	</label>
	<div class="month" role="group" aria-label="Day of the month">
		{#each weekdays as name (name)}
			<span class="weekday" aria-hidden="true">{name.slice(0, 3)}</span>
		{/each}
		{#each days as day (day)}
			{@const note = dayNote(day)}
			<button
				type="button"
				class="day"
				class:noted={note !== undefined}
				aria-pressed={calendar.day === day}
				aria-label={`${seasonName(calendar.season)} ${day}${note ? `, ${note}` : ""}`}
				title={note}
				onclick={() => (calendar.day = day)}
				data-testid={`calendar-day-${day}`}>{day}</button
			>
		{/each}
	</div>
	<p class="today" data-testid="calendar-date">
		{formatDate(calendar.date)}{calendar.festival
			? `: ${calendar.festival.name}`
			: ""}
	</p>
	{#each calendar.dateProblems as problem (problem)}
		<small class="problem" data-testid="calendar-date-problem">{problem}</small>
	{/each}
	<small
		>Days played ({calendar.daysPlayed}) changes to match. Changing the date
		doesn't do what happens overnight: crops outside that are out of season die
		the next time you sleep, and special orders and other timers keep their due
		dates. The game's load screen shows the old date until you save in-game.</small
	>
</div>

<h3>Weather</h3>
<div class="settings">
	<label>
		<span class="weather-label">
			{@render weatherIcon(calendar.today, calendar.season)}
			Today
		</span>
		<UiSelect
			value={calendar.today}
			onchange={(e) =>
				choose(
					e.currentTarget,
					(v) => (calendar.today = v),
					() => calendar.today,
				)}
			disabled={onlyChoice(calendar.todayOptions, calendar.today)}
			data-testid="weather-today"
		>
			{#each calendar.todayOptions as option (option.id)}
				<option value={option.id} disabled={!option.allowed}
					>{option.label}</option
				>
			{/each}
		</UiSelect>
	</label>
	{#if calendar.forcedToday}
		<small data-testid="weather-today-forced"
			>{calendar.forcedToday.reason}.</small
		>
	{:else}
		<small
			>What you wake up to. Choosing rain waters the farm's tilled soil and pet
			bowl, as a rainy morning does; taking the rain away again only dries what
			that watered.</small
		>
	{/if}
	<label>
		<span class="weather-label">
			{@render weatherIcon(calendar.tomorrow, tomorrow.season)}
			Tomorrow
		</span>
		<UiSelect
			value={calendar.tomorrow}
			onchange={(e) =>
				choose(
					e.currentTarget,
					(v) => (calendar.tomorrow = v),
					() => calendar.tomorrow,
				)}
			disabled={onlyChoice(calendar.tomorrowOptions, calendar.tomorrow)}
			data-testid="weather-tomorrow"
		>
			{#each calendar.tomorrowOptions as option (option.id)}
				<option value={option.id} disabled={!option.allowed}
					>{option.label}</option
				>
			{/each}
		</UiSelect>
	</label>
	{#if calendar.forcedTomorrow}
		<small data-testid="weather-tomorrow-forced"
			>{calendar.forcedTomorrow.reason}, whatever the forecast says.</small
		>
	{:else}
		<small
			>The forecast on the TV. Ginger Island and the desert keep their own
			weather.</small
		>
		{#if calendar.tomorrow === "GreenRain"}
			<small data-testid="weather-green-rain-note"
				>The game picks one green rain day each summer (Summer {calendar.greenRainDay(
					tomorrow.year,
				)} in Year {tomorrow.year}). Green rain on another day still grows its
				weeds and trees, but if you reload that day's save, the game won't clear
				them away the next day.</small
			>
		{/if}
	{/if}
</div>

<style>
	.settings {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 8px 16px;
		font-weight: bold;
	}

	.settings label {
		display: grid;
		grid-template-columns: 1fr 14rem;
		align-items: center;
		gap: 8px;
		margin-top: 8px;
	}

	.settings small {
		font-size: x-small;
		font-weight: normal;
		opacity: 0.8;
	}

	.settings small.problem {
		color: #b8312f;
		opacity: 1;
	}

	.month {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 2.5rem));
		gap: 4px;
		margin-top: 8px;
		justify-content: center;
	}

	.weekday {
		font-size: x-small;
		text-align: center;
	}

	.day {
		position: relative;
		padding: 4px 0;
		border: solid 2px;
		border-radius: 4px;
		border-bottom-color: #9c613b;
		border-left-color: #9c613b;
		border-right-color: #6f3b31;
		border-top-color: #6f3b31;
		background-color: #f9bb65;
		color: #3f2117;
		font: inherit;
		cursor: pointer;
	}

	.day:hover {
		filter: brightness(1.05);
	}

	.day[aria-pressed="true"] {
		background-color: #de9a3c;
		box-shadow: inset 0 0 0 2px #5b2b29;
	}

	/* A dot in the corner on festival, storm and green rain days */
	.day.noted::after {
		position: absolute;
		top: 2px;
		right: 3px;
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background-color: #b8312f;
		content: "";
	}

	.day:focus-visible {
		outline: 2px solid #5b2b29;
		outline-offset: 1px;
	}

	.today {
		margin: 4px 0 0;
		text-align: center;
	}

	.weather-label {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.weather-icon {
		display: inline-block;
		width: 12px;
		height: 8px;
		zoom: 2;
		background-image: var(--sheet);
		image-rendering: pixelated;
	}

	.weather-icon.green {
		filter: hue-rotate(-110deg);
	}
</style>
