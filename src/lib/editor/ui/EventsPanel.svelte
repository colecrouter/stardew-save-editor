<script lang="ts">
	import { asset } from "$app/paths";
	import { Result } from "effect";
	import { useAtomValue } from "effect-atom-svelte";
	import {
		VanillaEvents,
		VanillaEventsById,
		type EventInfo,
	} from "../../Events.ts";
	import { characters } from "../../NPCs.ts";
	import { toEventId } from "../../eventId.ts";
	import type { EditorModel } from "../editor-model.ts";
	import type { CommandResult } from "../command-result.ts";
	import { createEventDomain } from "../event-domain.ts";
	import { createFarmerSelectionField } from "../farmer-selection.ts";
	import CheckboxField from "./fields/CheckboxField.svelte";
	import FarmerSelector from "./fields/FarmerSelector.svelte";

	interface Props {
		model: EditorModel;
	}
	let { model }: Props = $props();
	const view = useAtomValue(() => model.atomBindings.view);
	const selection = useAtomValue(() => model.atomBindings.selectedFarmerId);
	const farmerField = $derived(
		createFarmerSelectionField(
			view.current?.characters ?? [],
			selection.current,
			model,
		),
	);
	const selected = $derived(
		view.current?.events.find((owner) => owner.farmerId === selection.current),
	);
	const domain = $derived(
		selected ? createEventDomain(selected, model) : undefined,
	);
	const portraits = new Set<string>(characters);
	const inputId = $props.id();
	let search = $state("");
	let grouping = $state("npc");
	let filter = $state("all");
	let limit = $state(24);
	let newId = $state("");
	let pending = $state(false);
	let feedback = $state<{
		scope: symbol;
		farmerId: string;
		message: string;
		failed: boolean;
	}>();
	const typedId = $derived(newId.trim());
	const parsedId = $derived(toEventId(typedId));
	const inputHint = $derived(
		!typedId
			? ""
			: parsedId === undefined
				? 'Use a plain numeric or text ID without spaces or "/"; it must survive saving unchanged.'
				: parsedId !== typedId
					? `Saved as ${parsedId}, without leading zeros.`
					: "",
	);
	const term = $derived(search.trim().toLowerCase());
	const seen = $derived(new Set(domain?.seen.map((event) => event.id) ?? []));
	const groups = $derived.by(() => {
		// A shared event can appear under several NPCs. Every occurrence addresses
		// the same domain field; presentation grouping never duplicates saved IDs.
		const result = new Map<string, EventInfo[]>();
		for (const event of VanillaEvents) {
			const names =
				grouping === "location"
					? [event.location]
					: event.npcs.length
						? event.npcs
						: ["Other"];
			for (const name of names)
				result.set(name, [...(result.get(name) ?? []), event]);
		}
		return [...result].sort(([a], [b]) =>
			a === "Other" ? 1 : b === "Other" ? -1 : a.localeCompare(b),
		);
	});
	const matches = (event: EventInfo) =>
		(filter === "all" || seen.has(event.id) === (filter === "seen")) &&
		(!term ||
			[
				event.id,
				event.name,
				event.description,
				event.location,
				...event.npcs,
			].some((text) => text.toLowerCase().includes(term)));
	const filteredGroups = $derived(
		groups
			.map(([name, events]) => ({
				name,
				events: events.filter(matches),
				seenCount: events.filter((event) => seen.has(event.id)).length,
				total: events.length,
			}))
			.filter((group) => group.events.length),
	);
	const unknown = $derived(
		filter === "unseen"
			? []
			: (domain?.seen ?? []).filter(
					(event) =>
						!VanillaEventsById.has(event.id) &&
						(!term || event.id.toLowerCase().includes(term)),
				),
	);
	const matchingCount = $derived(
		filteredGroups.reduce((count, group) => count + group.events.length, 0) +
			unknown.length,
	);
	const shown = $derived.by(() => {
		// Bound mounted controllers across all groups, not once per group. Search
		// still considers the entire catalog and the complete imported ID list.
		let remaining = limit;
		const groups = filteredGroups
			.map((group) => {
				const events = group.events.slice(0, remaining);
				remaining -= events.length;
				return { ...group, events };
			})
			.filter((group) => group.events.length);
		return { groups, unknown: unknown.slice(0, remaining) };
	});
	function changePresentation() {
		// A filtered-away field must finish its gesture before its control unmounts.
		void model.edits.endActive();
		limit = 24;
	}
	async function perform(
		action: () => Promise<CommandResult<unknown, { message: string }>>,
		target: NonNullable<typeof domain>,
		success: string,
		submitted?: string,
	) {
		if (pending) return;
		const scope = model.edits.scope;
		pending = true;
		feedback = undefined;
		try {
			const result = await action();
			// Commands retain the captured farmer. Late results must not clear input
			// or display a message in another farmer's view (or another file scope).
			if (
				!result ||
				model.edits.scope !== scope ||
				domain?.farmerId !== target.farmerId
			)
				return;
			const failed = Result.isFailure(result);
			feedback = {
				scope,
				farmerId: target.farmerId,
				failed,
				message: failed ? result.failure.message : success,
			};
			if (!failed && submitted !== undefined && newId === submitted) newId = "";
		} finally {
			pending = false;
		}
	}
	function remove(id: string) {
		const target = domain;
		if (!target) return;
		void perform(() => target.remove(id), target, `Marked #${id} as unseen.`);
	}
	function add(event: SubmitEvent) {
		event.preventDefault();
		const target = domain;
		const id = parsedId;
		if (!target || id === undefined || !target.supported) return;
		const submitted = newId;
		const alreadySeen = seen.has(id);
		void perform(
			() => target.add(submitted),
			target,
			alreadySeen
				? `#${id} was already marked as seen.`
				: `Marked #${id} as seen.`,
			submitted,
		);
	}
</script>

<div class="heading">
	<h1>Events</h1>
	<FarmerSelector field={farmerField} />
</div>

<p class="intro">
	Mark an event as unseen to let it play again when its location and conditions
	match; its rewards may be given again. Marking it seen skips it without
	granting rewards.
</p>

{#if domain?.supported}
	{#if domain.unsupportedCount}
		<p class="hint">
			Some imported event entries cannot be represented as editable IDs and are
			preserved unchanged.
		</p>
	{/if}
	<div class="toolbar">
		<strong>Events seen: {domain.seenCount}</strong>
		<form onsubmit={add}>
			<label>
				Event ID to mark as seen
				<input
					type="text"
					bind:value={newId}
					placeholder="1 or Mod.Id_Event"
					aria-describedby={inputHint ? `${inputId}-hint` : undefined}
				/>
			</label>
			<button type="submit" disabled={pending || parsedId === undefined}>
				Mark as seen
			</button>
		</form>
	</div>

	{#if inputHint}<p id={`${inputId}-hint`} class="hint">{inputHint}</p>{/if}
	{#if feedback?.scope === model.edits.scope && feedback.farmerId === domain.farmerId}
		<p role={feedback.failed ? "alert" : "status"}>{feedback.message}</p>
	{/if}

	<div class="filters">
		<label>
			Search events
			<input
				type="search"
				bind:value={search}
				oninput={changePresentation}
				placeholder="Events, villagers or places"
			/>
		</label>
		<label>
			Group by
			<select
				value={grouping}
				onchange={(event) => {
					grouping = event.currentTarget.value;
					changePresentation();
				}}
			>
				<option value="npc">Character</option>
				<option value="location">Location</option>
			</select>
		</label>
		<label>
			Show events
			<select
				value={filter}
				onchange={(event) => {
					filter = event.currentTarget.value;
					changePresentation();
				}}
			>
				<option value="all">All events</option>
				<option value="seen">Seen</option>
				<option value="unseen">Not seen</option>
			</select>
		</label>
	</div>

	{#key domain.farmerId}
		<div class="event-groups">
			{#each shown.groups as group (group.name)}
				<section aria-label={`${group.name} events`}>
					<h2>
						{#if grouping === "npc" && portraits.has(group.name)}
							<span class="portrait">
								<img
									src={asset(`/assets/portraits/${group.name}.png`)}
									alt=""
								/>
							</span>
						{/if}
						{group.name}
						<small>{group.seenCount}/{group.total} seen</small>
					</h2>
					{#each group.events as event (event.id)}
						<div class="event">
							<CheckboxField
								field={domain.field(event.id, event.name)}
								description={event.description || undefined}
							/>
							<p class="meta">
								#{event.id} · {event.location}{#if event.npcs.length}
									· {event.npcs.join(", ")}{/if}
							</p>
						</div>
					{/each}
				</section>
			{/each}

			{#if shown.unknown.length}
				<section aria-label="Other seen events">
					<h2>Other seen events</h2>
					<p class="hint">
						Imported IDs outside the vanilla event list, including events from
						mods.
					</p>
					{#each shown.unknown as event (event.id)}
						<div class="unknown event">
							<code>{event.id}</code>
							<button
								type="button"
								disabled={pending || !event.supported}
								onclick={() => remove(event.id)}
							>
								Remove {event.id}
							</button>
							{#if event.reason}<p class="hint">{event.reason}</p>{/if}
						</div>
					{/each}
				</section>
			{/if}
		</div>
	{/key}

	{#if matchingCount > limit}
		<button type="button" class="more" onclick={() => (limit += 24)}>
			Show more events ({matchingCount - limit} remaining)
		</button>
	{:else if matchingCount === 0}
		<p role="status">No events match the current filters.</p>
	{/if}

	<p class="credit">
		Event names from the <a
			href="https://stardewmodding.wiki.gg/wiki/List_of_Vanilla_Event_IDs"
		>
			List of Vanilla Event IDs
		</a>
		on the Stardew Modding Wiki, licensed under
		<a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>
		.
	</p>
{:else}
	<p role="status">{domain?.reason ?? "No supported farmer is available."}</p>
{/if}

<style>
	.heading,
	.toolbar,
	.filters,
	form {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: 14px;
	}
	.heading,
	.toolbar {
		justify-content: space-between;
	}
	h1 {
		margin: 0;
	}
	.intro {
		line-height: 1.5;
	}
	form {
		flex: 1;
		justify-content: flex-end;
	}
	label {
		display: grid;
		gap: 6px;
		min-width: 0;
	}
	input,
	select,
	button {
		font: inherit;
		min-height: 40px;
		box-sizing: border-box;
	}
	input,
	select {
		background: #fff2d3;
		color: #351b0e;
		border: 2px solid #b99058;
		padding: 6px 8px;
	}
	button {
		cursor: pointer;
		padding: 6px 12px;
		color: #351b0e;
	}
	button:disabled {
		cursor: default;
		opacity: 0.6;
	}
	.filters {
		margin: 24px 0;
	}
	.filters label:first-child {
		flex: 1;
	}
	.event-groups {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 24px;
	}
	section {
		min-width: 0;
	}
	h2 {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 0 0 10px;
		font-size: 24px;
	}
	h2 small {
		margin-left: auto;
		font-size: 16px;
		white-space: nowrap;
	}
	.portrait {
		width: 40px;
		height: 40px;
		overflow: hidden;
		flex: none;
		image-rendering: pixelated;
	}
	.portrait img {
		/* Keep the full sheet at native size, then crop its first 64px frame
		   to 40px. Resizing the sheet first would reveal several expressions. */
		width: 128px;
		max-width: none;
		height: auto;
		transform: scale(0.625);
		transform-origin: top left;
	}
	.event {
		border-top: 1px solid #bb925e;
		padding: 12px 0;
	}
	.meta,
	.hint,
	.credit {
		font-size: 16px;
		line-height: 1.4;
		color: #694621;
	}
	.meta {
		margin: 6px 0 0;
	}
	.unknown {
		display: flex;
		gap: 10px;
		align-items: center;
		flex-wrap: wrap;
	}
	code {
		overflow-wrap: anywhere;
		min-width: 0;
		flex: 1;
	}
	.more {
		margin-top: 20px;
	}
	.credit {
		margin-top: 24px;
	}
	@media (max-width: 900px) {
		.event-groups {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	@media (max-width: 600px) {
		form,
		form label,
		.filters label {
			width: 100%;
		}
		form button {
			width: 100%;
		}
		.filters {
			align-items: stretch;
		}
		h2 {
			font-size: 22px;
		}
	}
</style>
