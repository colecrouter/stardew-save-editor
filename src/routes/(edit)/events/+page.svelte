<script lang="ts">
	import { asset } from "$app/paths";
	import {
		type EventInfo,
		VanillaEvents,
		VanillaEventsById,
	} from "$lib/Events";
	import { characters } from "$lib/NPCs";
	import { type EventsSeen, toEventId } from "$lib/proxies/EventsSeen.svelte";
	import { getSaveManager } from "$lib/SaveManager.svelte";
	import UiCheckbox from "$lib/ui/UICheckbox.svelte";
	import UiContainer from "$lib/ui/UIContainer.svelte";
	import UiInput from "$lib/ui/UIInput.svelte";
	import UiSelect from "$lib/ui/UISelect.svelte";

	const save = getSaveManager().save;
	if (!save) throw new Error("No save data found");
	const player = $derived(save.player);
	const seen = $derived(player.eventsSeen);

	const OTHER = "Other";
	const portraits = new Set<string>(characters);

	let search = $state("");
	let groupBy = $state("npc");
	let show = $state("all");

	// Every event under each of its characters (or "Other"), or under its location
	const groups = $derived.by(() => {
		const byName = new Map<string, EventInfo[]>();
		for (const event of VanillaEvents) {
			const names =
				groupBy === "location"
					? [event.location]
					: event.npcs.length > 0
						? event.npcs
						: [OTHER];
			for (const name of names) {
				const events = byName.get(name) ?? [];
				events.push(event);
				byName.set(name, events);
			}
		}
		return [...byName].sort(([a], [b]) =>
			a === OTHER ? 1 : b === OTHER ? -1 : a.localeCompare(b),
		);
	});

	const term = $derived(search.trim().toLowerCase());
	const matches = (event: EventInfo) =>
		(show === "all" || seen.has(event.id) === (show === "seen")) &&
		(!term ||
			[
				event.id,
				event.name,
				event.description,
				event.location,
				...event.npcs,
			].some((text) => text.toLowerCase().includes(term)));

	const shown = $derived(
		groups
			.map(([name, events]) => ({
				name,
				events: events.filter(matches),
				seenCount: events.filter((event) => seen.has(event.id)).length,
				total: events.length,
			}))
			.filter((group) => group.events.length > 0),
	);

	// Seen IDs the wiki doesn't list, e.g. from mods
	const unknown = $derived(
		show === "unseen"
			? []
			: [...seen].filter(
					(id) =>
						!VanillaEventsById.has(id) &&
						(!term || id.toLowerCase().includes(term)),
				),
	);

	// What the add form last did, shown until the list changes or the farmer does
	let added = $state<{ seen: EventsSeen; message: string }>();
	const addedMessage = $derived(added?.seen === seen ? added.message : "");

	function toggle(id: string) {
		added = undefined;
		if (seen.has(id)) seen.delete(id);
		else seen.add(id);
	}

	function remove(id: string) {
		added = undefined;
		seen.delete(id);
	}

	let newId = $state("");
	const typed = $derived(newId.trim());
	const id = $derived(toEventId(typed));
	const idHint = $derived(
		!typed
			? ""
			: id === undefined
				? /[\s/]/.test(typed)
					? `Event IDs can't contain spaces or "/".`
					: `Write numbers plainly (e.g. 1000, not 1e3 or 1.0), or the save reads "${typed}" back as a different ID.`
				: id !== typed
					? `Saved as ${id}, without the leading zeros.`
					: "",
	);

	function add(event: SubmitEvent) {
		event.preventDefault();
		if (id === undefined) return;
		const name = VanillaEventsById.get(id)?.name;
		const label = name ? `${name} (#${id})` : `#${id}`;
		added = {
			seen,
			message: seen.has(id)
				? `${label} was already marked as seen.`
				: `Marked ${label} as seen.`,
		};
		seen.add(id);
		newId = "";
	}
</script>

<UiContainer>
	<h3>Events</h3>
	<p class="hint">
		Untick an event to watch it again: it plays the next time {player.name} enters
		its location while its conditions (hearts, time of day, weather...) are met,
		and anything it gives is given again. Tick one to skip it: {player.name} won't
		get anything it would have given.
	</p>

	<div class="toolbar">
		<h4 data-testid="events-seen-count">Events seen: {seen.size}</h4>
		<form class="add" onsubmit={add}>
			<UiInput
				type="text"
				placeholder="Event ID, e.g. 1 or Mod.Id_Event"
				aria-label="Event ID to mark as seen"
				bind:value={newId}
				data-testid="event-id-input"
			/>
			<button type="submit" disabled={id === undefined} data-testid="add-event">
				Mark as seen
			</button>
		</form>
	</div>
	{#if idHint}
		<small class="status" data-testid="event-id-hint">{idHint}</small>
	{:else if addedMessage}
		<small class="status" data-testid="event-added">{addedMessage}</small>
	{/if}

	<div class="search">
		<UiInput
			type="search"
			placeholder="Search events, villagers or places..."
			aria-label="Search events"
			bind:value={search}
			data-testid="events-search"
		/>
	</div>
	<div class="filters">
		<label>
			Group by
			<UiSelect
				value={groupBy}
				onchange={(e) => (groupBy = e.currentTarget.value)}
				data-testid="events-group"
			>
				<option value="npc">Character</option>
				<option value="location">Location</option>
			</UiSelect>
		</label>
		<label>
			Show
			<UiSelect
				value={show}
				onchange={(e) => (show = e.currentTarget.value)}
				data-testid="events-show"
			>
				<option value="all">All</option>
				<option value="seen">Seen</option>
				<option value="unseen">Not seen</option>
			</UiSelect>
		</label>
	</div>

	<div class="wrapper">
		{#each shown as group (group.name)}
			<section data-testid="event-group">
				<h4>
					{#if groupBy === "npc" && portraits.has(group.name)}
						<span class="portrait">
							<img src={asset(`/assets/portraits/${group.name}.png`)} alt="" />
						</span>
					{/if}
					<span data-testid="event-group-name">{group.name}</span>
					<small>({group.seenCount}/{group.total})</small>
				</h4>
				{#each group.events as event (event.id)}
					{@const others = event.npcs.filter((name) => name !== group.name)}
					<label class="entry" data-testid="event-row">
						<span class="text">
							<span class="name" data-testid="event-name">{event.name}</span>
							{#if event.description}
								<small class="description">{event.description}</small>
							{/if}
							<small class="meta">
								#{event.id}
								{#if groupBy === "location"}
									{#if event.npcs.length > 0}· {event.npcs.join(", ")}{/if}
								{:else}
									· {event.location}
									{#if others.length > 0}· with {others.join(", ")}{/if}
								{/if}
							</small>
						</span>
						<UiCheckbox
							checked={seen.has(event.id)}
							onchange={() => toggle(event.id)}
							data-testid="event-{event.id}"
						/>
					</label>
				{/each}
			</section>
		{/each}

		{#if unknown.length > 0}
			<section data-testid="unknown-events">
				<h4>Other seen events <small>({unknown.length})</small></h4>
				<small class="note">
					Not on the wiki's list of vanilla events, e.g. added by mods.
				</small>
				{#each unknown as unknownId (unknownId)}
					<div class="entry" data-testid="unknown-event">
						<code>{unknownId}</code>
						<button
							type="button"
							onclick={() => remove(unknownId)}
							data-testid="remove-event-{unknownId}"
						>
							Remove
						</button>
					</div>
				{/each}
			</section>
		{/if}

		{#if shown.length === 0 && unknown.length === 0}
			<p class="empty">
				{#if term}
					No events match "{search}".
				{:else}
					No events to show.
				{/if}
			</p>
		{/if}
	</div>
	<small class="credit">
		Event names from the
		<a
			href="https://stardewmodding.wiki.gg/wiki/List_of_Vanilla_Event_IDs"
			target="_blank"
			rel="noreferrer">List of Vanilla Event IDs</a
		>
		on the Stardew Modding Wiki (<a
			href="https://creativecommons.org/licenses/by-sa/4.0/"
			target="_blank"
			rel="noreferrer">CC BY-SA 4.0</a
		>).
	</small>
</UiContainer>

<style>
	.hint {
		margin: 0 4px 8px;
		font-size: 0.85em;
		opacity: 0.85;
	}

	.toolbar {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
	}

	.add {
		display: flex;
		flex: 1;
		justify-content: flex-end;
		align-items: center;
		gap: 6px;
	}

	.add :global(input) {
		flex: 1;
		min-width: 0;
		max-width: 20em;
	}

	.status {
		display: block;
		margin: 0 4px 4px;
		font-size: x-small;
		opacity: 0.8;
	}

	.search :global(input) {
		width: 100%;
		margin: 4px 0 6px;
		font-size: large;
	}

	.filters {
		display: flex;
		gap: 12px;
		margin-bottom: 8px;
	}

	.filters label {
		display: flex;
		flex: 1;
		align-items: center;
		gap: 6px;
		white-space: nowrap;
	}

	.wrapper {
		overflow-y: scroll;
		/* Fill the window below the page header, never below 20rem */
		height: max(20rem, calc(100dvh - 459px));
	}

	section h4 {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 10px 0 2px;
	}

	/* The first 64px frame of the portrait sheet, at half size */
	.portrait {
		width: 32px;
		height: 32px;
		overflow: hidden;
		flex-shrink: 0;
	}

	.portrait img {
		transform: scale(0.5);
		transform-origin: top left;
		image-rendering: pixelated;
	}

	.entry {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
		border-bottom: #5b2b2a 1px solid;
		padding: 4px 0.5em;
	}

	label.entry {
		cursor: pointer;
	}

	.text {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.description {
		font-size: 0.85em;
		opacity: 0.85;
	}

	.meta,
	.note {
		font-size: x-small;
		opacity: 0.8;
	}

	.note {
		display: block;
		margin: 0 0.5em 4px;
	}

	code {
		overflow-wrap: anywhere;
	}

	button {
		padding: 1px 6px;
		border-radius: 4px;
		border: 1px solid #5b2b2a;
		background: none;
		color: inherit;
		font-family: inherit;
		font-size: 0.8em;
		white-space: nowrap;
		cursor: pointer;
	}

	button:hover:enabled {
		background-color: #5b2b2a;
		color: #f9bb65;
	}

	button:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.empty {
		opacity: 0.7;
		text-align: center;
	}

	.credit {
		display: block;
		margin-top: 6px;
		font-size: x-small;
		opacity: 0.8;
	}
</style>
