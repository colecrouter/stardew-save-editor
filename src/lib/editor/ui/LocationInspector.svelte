<script lang="ts">
	import { useAtomValue } from "effect-atom-svelte";

	import StudyAside from "../../ui/kit/StudyAside.svelte";
	import type { EditorModel } from "../editor-model.ts";

	let { model }: { model: EditorModel } = $props();
	const view = useAtomValue(() => model.atomBindings.view);
	let selectedId = $state("");
	let search = $state("");

	// Default to the first visible record when the current selection is unavailable.
	const locations = $derived(view.current?.locations ?? []);
	const location = $derived(
		locations.find((row) => row.id === selectedId) ?? locations[0],
	);
	const objects = $derived(
		location?.objects.filter((object) =>
			`${object.name} ${object.type} ${object.x ?? "?"}, ${object.y ?? "?"}`
				.toLowerCase()
				.includes(search.trim().toLowerCase()),
		) ?? [],
	);
</script>

<h1>Locations</h1>

<StudyAside title="Placed objects">
	{#if location}
		<label>
			Location
			<select
				class="study-input"
				value={location.id}
				onchange={(event) => {
					selectedId = event.currentTarget.value;
				}}
			>
				{#each locations as row (row.id)}
					<option value={row.id}>{row.name}</option>
				{/each}
			</select>
		</label>

		{#if location.readable}
			<label>
				Find a placed object
				<input
					class="study-input"
					type="search"
					bind:value={search}
				/>
			</label>

			{#if objects.length > 0}
				<table>
					<caption>Saved object tiles in {location.name}</caption>
					<thead>
						<tr>
							<th scope="col">Object</th>
							<th scope="col">Type</th>
							<th scope="col">Tile (X, Y)</th>
						</tr>
					</thead>
					<tbody>
						<!-- Preserve duplicate saved tiles as separate rows for inspection. -->
						{#each objects as object (object.index)}
							<tr>
								<td>{object.name}</td>
								<td>{object.type}</td>
								<td>{object.x ?? "?"}, {object.y ?? "?"}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{:else}
				<p>
					{location.objects.length === 0
						? "No placed objects."
						: "No objects match the search."}
				</p>
			{/if}
		{:else}
			<p>This location has no readable placed-object list.</p>
		{/if}
	{:else}
		<p>No saved locations are available.</p>
	{/if}
</StudyAside>

<style>
	label {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		margin-block: 8px;
	}

	select,
	input {
		max-width: 100%;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		text-align: left;
	}
	caption {
		text-align: left;
		margin-block: 8px;
	}
	th,
	td {
		padding: 6px;
		border-bottom: 1px solid #ba8c52;
		overflow-wrap: anywhere;
	}
</style>
