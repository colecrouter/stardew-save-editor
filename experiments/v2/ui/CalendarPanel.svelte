<script lang="ts">
	import { setCalendarWeather } from "../calendar-operations.ts";
	import { useAtomValue } from "effect-atom-svelte";
	import type { createRuneDraft } from "../field.svelte.ts";
	import type { GameDate } from "../../../src/lib/calendar.ts";
	import type { EditorModel } from "../editor-model.ts";
	import {
		formatDate,
		nextDay,
		SEASONS,
		seasonName,
	} from "../../../src/lib/calendar.ts";
	import WeatherIcon from "../../../src/lib/ui/WeatherIcon.svelte";
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
	let error = $state("");
	const edit = (part: "year" | "season" | "day", value: string) =>
		draft.input(JSON.stringify({ ...parts, [part]: value }));
	// Weather is an immediate explicit command, unlike the staged date form.
	// Capture the displayed revision so an intervening commit cannot be overwritten.
	async function weather(day: "today" | "tomorrow", value: string) {
		error = "";
		try {
			await model.transact(
				setCalendarWeather(day, value),
				view.current?.revision,
			);
		} catch (cause) {
			error = String(cause);
		}
	}
</script>

{#if view.current}
	<header>
		<h1>Date and weather</h1>
		<p>Current save: {formatDate(view.current.calendar.date)}</p>
	</header>
	<div class="calendar-layout">
		<section class="study-pane date-panel" aria-label="Farm date">
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
				<div class="days" role="group" aria-label="Day of month">
					{#each Array.from({ length: 28 }, (_, i) => i + 1) as day (day)}
						<button
							type="button"
							aria-pressed={Number(parts.day) === day}
							disabled={pending.current > 0}
							onclick={() => edit("day", String(day))}
						>
							{day}
						</button>
					{/each}
				</div>
				<div class="actions">
					<button
						type="submit"
						disabled={!draft.current.dirty ||
							draft.current.conflict ||
							pending.current > 0}
					>
						Apply date
					</button>
					<button
						type="button"
						onclick={draft.reload}
						disabled={pending.current > 0 ||
							(!draft.current.dirty && !draft.current.conflict)}
					>
						Reload current date
					</button>
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
		<section class="study-pane weather-panel" aria-label="Weather">
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
					{day === "today" ? "Today" : "Tomorrow"}
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
		<p role="alert">{error}</p>
	{/if}
	<p class="notice">
		Changing the date does not simulate an overnight transition. Review changes
		before exporting.
	</p>
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
		grid-template-columns: minmax(0, 1fr) 190px;
		gap: 16px;
		max-width: 900px;
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
	.days {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		margin-block: 12px;
	}
	.days button {
		padding: 4px;
		min-height: 42px;
		border: 1px solid #bd965e;
		background: #fff0cf;
		font: inherit;
	}
	.days button[aria-pressed="true"] {
		background: #8dccf5;
		box-shadow: inset 0 0 0 2px #2584c3;
	}
	.actions {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	button {
		cursor: pointer;
		font: inherit;
		min-height: 40px;
		padding: 5px 10px;
		color: #351b0e;
	}
	button:disabled {
		cursor: default;
		opacity: 0.6;
	}
	.weather-picture {
		display: grid;
		place-items: center;
		background: #fce8bf;
		padding: 6px;
	}
	.weather-panel label {
		margin-top: 12px;
	}
	small {
		display: block;
		font-size: 17px;
		margin-top: 5px;
	}
	.notice {
		margin-top: 16px;
		padding: 12px;
		background: #d5e8ef;
		border: 2px solid #90b6c4;
	}
	[role="alert"] {
		color: #8a1c19;
	}
	@media (max-width: 650px) {
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
</style>
