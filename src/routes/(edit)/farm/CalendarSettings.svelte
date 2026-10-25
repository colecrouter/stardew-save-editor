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
	import UiButton from "$lib/ui/UIButton.svelte";
	import UiField from "$lib/ui/UIField.svelte";
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
		class={["weather-icon", { green: weather === "GreenRain" }]}
		style:--sheet={index === undefined ? undefined : sheet}
		style:background-position={`-${317 + 12 * (index ?? 0)}px -421px`}
		aria-hidden="true"
	></span>
{/snippet}

<div class="calendar-layout">
	<div class="settings date-panel">
		<div class="date-inputs">
			<UiField label="Year">
				{#snippet children(field)}
					<!-- UiInput only passes on years that fit min, max and step, and puts
		the current year back (defaultValue) if the field is left empty -->
					<UiInput
						id={field.id}
						aria-describedby={field.describedby}
						type="number"
						min="1"
						max={MAX_YEAR}
						step="1"
						defaultValue={calendar.year}
						bind:value={
							() => yearDraft ?? calendar.year,
							(v) => {
								const year = v === null ? undefined : Number(v);
								yearDraft = year === calendar.year ? undefined : year;
							}
						}
						onchange={applyYear}
						data-testid="calendar-year"
					/>
				{/snippet}
			</UiField>
			<UiField label="Season">
				{#snippet children(field)}
					<UiSelect
						id={field.id}
						aria-describedby={field.describedby}
						value={calendar.season}
						onchange={(e) =>
							(calendar.season = e.currentTarget.value as Season)}
						data-testid="calendar-season"
					>
						{#each SEASONS as season (season)}
							<option value={season}>{seasonName(season)}</option>
						{/each}
					</UiSelect>
				{/snippet}
			</UiField>
		</div>
		<div class="month" role="group" aria-label="Day of the month">
			{#each weekdays as name (name)}
				<span class="weekday" aria-hidden="true">{name.slice(0, 3)}</span>
			{/each}
			{#each days as day (day)}
				{@const note = dayNote(day)}
				<UiButton
					variant="plain"
					type="button"
					class={note !== undefined ? "day noted" : "day"}
					aria-pressed={calendar.day === day}
					aria-label={`${seasonName(calendar.season)} ${day}${note ? `, ${note}` : ""}`}
					title={note}
					onclick={() => (calendar.day = day)}
					data-testid={`calendar-day-${day}`}>{day}</UiButton
				>
			{/each}
		</div>
		<p class="today" data-testid="calendar-date">
			{formatDate(calendar.date)}{calendar.festival
				? `: ${calendar.festival.name}`
				: ""}
		</p>
		{#each calendar.dateProblems as problem (problem)}
			<small class="problem" data-testid="calendar-date-problem"
				>{problem}</small
			>
		{/each}
		<details class="calendar-help">
			<summary>About date changes</summary><small
				>Days played ({calendar.daysPlayed}) changes to match. Changing the date
				doesn't do what happens overnight: crops outside that are out of season
				die the next time you sleep, and special orders and other timers keep
				their due dates. The game's load screen shows the old date until you
				save in-game.</small
			>
		</details>
	</div>

	<div class="settings weather-panel">
		<h3>Weather</h3>
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
			<details>
				<summary>Rain and watering</summary><small
					>What you wake up to. Choosing rain waters tilled soil and pet bowls
					in known outdoor valley locations. Taking the rain away restores only
					that watering. Island, Desert and unresolved locations keep their own
					state.</small
				>
			</details>
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
			<details>
				<summary>About forecasts</summary><small
					>The forecast on the TV. Ginger Island and the desert keep their own
					weather.</small
				>
			</details>
			{#if calendar.tomorrow === "GreenRain"}
				<small data-testid="weather-green-rain-note"
					>The game picks one green rain day each summer (Summer {calendar.greenRainDay(
						tomorrow.year,
					)} in Year {tomorrow.year}). Green rain on another day still grows its
					weeds and trees, but if you reload that day's save, the game won't
					clear them away the next day.</small
				>
			{/if}
		{/if}
	</div>
</div>
<p class="date-notice">
	Changing the date does not simulate an overnight transition.
</p>

<style>
	.calendar-layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 180px;
		gap: 16px;
	}
	.date-panel,
	.weather-panel {
		border: 2px solid #bf9253;
		border-radius: 3px;
		background: #f9d99d66;
	}
	.date-inputs {
		display: grid;
		grid-template-columns: minmax(0, 0.8fr) minmax(0, 1fr);
		gap: 20px;
	}
	.date-inputs :global(.ui-field) {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 6px;
		margin: 0;
	}
	.date-inputs :global(input[type="number"]) {
		width: 100%;
	}
	.date-notice {
		background: #d5e8ef;
		border: 2px solid #90b6c4;
		padding: 14px 18px;
		margin-bottom: 0;
		color: #234d74;
	}
	.settings {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 12px;
		font-weight: bold;
	}

	.settings label {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		align-items: center;
		gap: 8px;
		margin-top: 8px;
	}

	.settings small {
		font-size: 20px;
		font-weight: normal;
		opacity: 0.8;
	}

	.settings small.problem {
		color: #b8312f;
		opacity: 1;
	}

	.month {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 0;
		margin-top: 8px;
		justify-content: center;
	}

	.weekday {
		font-size: 22px;
		text-align: center;
		border: 1px solid #c59a5b;
		padding: 6px 0;
	}

	.month :global(.day) {
		position: relative;
		padding: 4px 0;
		border: 1px solid #c59a5b;
		border-radius: 0;
		background: #ffefc5;
		min-height: 48px;
		min-width: 0;
	}
	.month :global(.wrapper) {
		min-width: 0;
	}

	.month :global(.day[aria-pressed="true"]) {
		background-color: #8dccf5;
		box-shadow: inset 0 0 0 2px #2584c3;
	}

	/* A dot in the corner on festival, storm and green rain days */
	.month :global(.day.noted)::after {
		position: absolute;
		top: 2px;
		right: 3px;
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background-color: #b8312f;
		content: "";
	}

	.month :global(.day:focus-visible) {
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
	.weather-panel label {
		gap: 14px;
	}
	.weather-panel .weather-label {
		flex-direction: column-reverse;
		align-items: start;
		gap: 16px;
	}

	.weather-icon {
		display: inline-block;
		width: 12px;
		height: 8px;
		zoom: 3;
		background-image: var(--sheet);
		image-rendering: pixelated;
	}

	.weather-icon.green {
		filter: hue-rotate(-110deg);
	}
	@media (max-width: 480px) {
		.calendar-layout {
			grid-template-columns: minmax(0, 1fr);
		}
		.weather-panel {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 12px;
		}
		.weather-panel h3,
		.weather-panel small,
		.weather-panel details {
			grid-column: 1 / -1;
		}
		.weather-panel label:nth-of-type(1) {
			grid-column: 1;
			grid-row: 2;
		}
		.weather-panel label:nth-of-type(2) {
			grid-column: 2;
			grid-row: 2;
		}
		.date-inputs {
			gap: 12px;
		}
		.settings {
			padding-inline: 8px;
		}
		.settings label {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
