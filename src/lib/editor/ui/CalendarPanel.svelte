<script lang="ts">
	import { Result } from "effect";
	import CalendarMonth from "./CalendarMonth.svelte";
	import { calendarEventsForMonth } from "../calendar-events.ts";
	import StudyButton from "../../ui/kit/StudyButton.svelte";
	import StudyAlert from "../../ui/kit/StudyAlert.svelte";
	import StudyAside from "../../ui/kit/StudyAside.svelte";
	import { setCalendarWeather } from "../calendar-operations.ts";
	import { useAtomValue } from "effect-atom-svelte";
	import type { createRuneDraft } from "../field.svelte.ts";
	import type { GameDate } from "../../calendar.ts";
	import type { EditorModel } from "../editor-model.ts";
	import { formatDate, nextDay, SEASONS, seasonName } from "../../calendar.ts";
	import WeatherIcon from "../../ui/WeatherIcon.svelte";
	interface Props {
		model: EditorModel;
		draft: ReturnType<typeof createRuneDraft<GameDate>>;
	}
	let { model, draft }: Props = $props();

	// Hooks subscribe through the nearest file provider. Keep the accessor object:
	// destructuring .current would capture a stale non-reactive value.
	const view = useAtomValue(() => model.atomBindings.view);
	const pending = useAtomValue(() => model.atomBindings.pending);
	const weatherDays = ["today", "tomorrow"] as const;
	// This JSON text is owned by the date draft, not the save. Preserve partially
	// entered strings; validation and conversion happen only when Apply is submitted.
	const parts = $derived(
		JSON.parse(draft.current.text) as {
			year: string;
			season: string;
			day: string;
		},
	);
	// Invalid partial year input remains owned by the draft. Only a readable month
	// can produce seed-dependent events; never silently invent a fallback year.
	const month = $derived({
		year: Number(parts.year),
		season:
			SEASONS.find((season) => season === parts.season) ??
			view.current?.calendar.date.season ??
			SEASONS[0],
		day: Number(parts.day),
	});
	const readableMonth = $derived(
		/^\d+$/.test(parts.year) &&
			Number.isSafeInteger(month.year) &&
			month.year >= 1 &&
			month.year <= 9999,
	);
	const occasions = $derived(
		view.current && readableMonth
			? calendarEventsForMonth(month, view.current.calendarEventContext)
			: [],
	);

	let error = $state("");
	const edit = (part: "year" | "season" | "day", value: string) =>
		draft.input(JSON.stringify({ ...parts, [part]: value }));
	// Weather is an immediate explicit command, unlike the staged date form.
	// Capture the displayed revision so an intervening commit cannot be overwritten.
	async function weather(day: "today" | "tomorrow", value: string) {
		error = "";
		const result = await model.commands.transact(
			setCalendarWeather(day, value),
			view.current?.revision,
		);
		if (result && Result.isFailure(result)) error = result.failure.message;
	}
</script>

{#if view.current}
	<header>
		<h1>Date and weather</h1>
		<p>Current save: {formatDate(view.current.calendar.date)}</p>
	</header>
	<div class="calendar-layout">
		<section class="date-panel" aria-label="Farm date">
			<h2>Farm date</h2>
			<form
				onsubmit={(event) => {
					event.preventDefault();
					void draft.submit();
				}}
			>
				<div class="date-fields">
					<label>
						Year
						<input
							type="number"
							min="1"
							max="9999"
							step="1"
							required
							bind:value={
								() => (parts.year === "" ? undefined : Number(parts.year)),
								(value) =>
									edit("year", value === undefined ? "" : String(value))
							}
							disabled={pending.current > 0}
							aria-describedby="date-feedback"
						/>
					</label>
					<label>
						Season
						<select
							bind:value={() => parts.season, (value) => edit("season", value)}
							disabled={pending.current > 0}
							aria-describedby="date-feedback"
						>
							{#each SEASONS as season (season)}
								<option value={season}>
									{seasonName(season)}
								</option>
							{/each}
						</select>
					</label>
				</div>
				<CalendarMonth
					yearLabel={readableMonth ? parts.year : "—"}
					eventsAvailable={readableMonth}
					date={month}
					saved={view.current.calendar.date}
					events={occasions}
					disabled={pending.current > 0}
					select={(day) => edit("day", String(day))}
				/>

				{#if !readableMonth}
					<StudyAlert
						title="Enter a year to show calendar events"
						tone="warning"
					>
						<p>The date draft is kept while you finish entering the year.</p>
					</StudyAlert>
				{/if}

				{#each view.current.calendarEventContext.notes as note}
					<p class="event-note">{note}</p>
				{/each}

				<div class="actions">
					<StudyButton
						intent="constructive"
						variant="filled"
						type="submit"
						disabled={!draft.current.dirty ||
							draft.current.conflict ||
							pending.current > 0}
					>
						Apply date
					</StudyButton>
					<StudyButton
						type="button"
						onclick={draft.reload}
						disabled={pending.current > 0 ||
							(!draft.current.dirty && !draft.current.conflict)}
					>
						Reload current date
					</StudyButton>
				</div>
				<p id="date-feedback" role="status">
					{#if draft.current.error}
						{draft.current.error}
					{:else if draft.current.conflict}
						The save changed. Your date draft is kept; reload the current date
						before applying.{:else if draft.current.pending}
						Applying date…{:else if draft.current.dirty}
						Unapplied date draft.{:else}
						Date matches the save.{/if}
				</p>
			</form>
		</section>
		<section class="weather-panel" aria-label="Weather">
			<h2>Weather</h2>
			{#each weatherDays as day (day)}
				{@const options =
					day === "today"
						? view.current.todayOptions
						: view.current.tomorrowOptions}
				{@const current = view.current.calendar[day]}
				{@const reason =
					day === "today"
						? view.current.todayReason
						: view.current.tomorrowReason}
				<label>
					<span class="weather-day">
						{day === "today" ? "Today" : "Tomorrow"}
					</span>
					<span class="weather-picture">
						<WeatherIcon
							weather={current}
							season={(day === "today"
								? view.current.calendar.date
								: nextDay(view.current.calendar.date)
							).season}
						/>
					</span>
					<select
						value={current}
						disabled={pending.current > 0 ||
							options.every(
								(option) => !option.allowed || option.id === current,
							)}
						onchange={(event) => void weather(day, event.currentTarget.value)}
					>
						{#each options as option (option.id)}
							<option value={option.id} disabled={!option.allowed}>
								{option.label}
							</option>
						{/each}
					</select>
				</label>
				{#if reason}
					<small>{reason}</small>
				{/if}
			{/each}
		</section>
	</div>
	{#if error}
		<StudyAlert
			title="Weather could not be changed"
			tone="danger"
			live="assertive"
		>
			<p>{error}</p>
		</StudyAlert>
	{/if}
	<StudyAside title="Changing the date">
		<p>
			Choose a date, then Apply date to commit its coordinated changes. This
			does not simulate an overnight transition. Weather edits apply separately
			to the current saved date.
		</p>
	</StudyAside>
{/if}

<style>
	header {
		border-bottom: 2px solid #ba8c52;
		margin-bottom: 16px;
		padding-bottom: 10px;
	}
	h1,
	h2,
	p {
		margin: 0 0 10px;
	}
	h1 {
		font-family: "Pixelify Sans", sans-serif;
		font-size: 32px;
	}
	h2 {
		font-size: 25px;
	}
	.calendar-layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 240px;
		gap: 16px;
		max-width: 1120px;
	}
	section {
		padding: 14px;
		min-width: 0;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 5px;
		min-width: 0;
	}
	input,
	select {
		min-height: 40px;
		min-width: 0;
		width: 100%;
		font: inherit;
		background: #fff0d9;
		color: #351b0e;
		border: 2px solid #b59466;
		padding: 4px 8px;
	}
	.date-fields {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}
	.actions {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.weather-picture {
		display: grid;
		place-items: center;
		min-height: 44px;
	}
	/* The icon belongs to its weather selector, rather than a separate preview
	   panel. Preserve a full-width caption and a native 44px control below it. */
	.weather-panel label {
		display: grid;
		grid-template-columns: 39px minmax(0, 1fr);
		align-items: center;
		gap: 6px 10px;
		margin-top: 16px;
	}
	.weather-day {
		grid-column: 1 / -1;
	}
	small {
		display: block;
		font-size: 17px;
		margin-top: 5px;
	}
	.event-note {
		color: #694621;
		font-size: 17px;
		margin-block: 12px;
	}
	.date-panel {
		padding: 0;
	}
	.date-fields {
		margin-bottom: 16px;
	}
	.weather-panel {
		background: #f3cf96;
		border: 2px solid #b98b52;
		align-self: start;
		padding: 16px;
	}
	.weather-panel select {
		min-height: 44px;
	}
	@media (max-width: 1050px) {
		.calendar-layout {
			grid-template-columns: minmax(0, 1fr);
		}
		.weather-panel {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 12px;
		}
		.weather-panel h2,
		.weather-panel small {
			grid-column: 1/-1;
		}
		.date-fields {
			gap: 8px;
		}
	}
	@media (max-width: 600px) {
		.weather-panel {
			grid-template-columns: minmax(0, 1fr);
			gap: 0;
		}
	}
</style>
