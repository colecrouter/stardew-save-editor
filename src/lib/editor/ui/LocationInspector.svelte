<script lang="ts">
	import { Result } from "effect";
	import { useAtomValue } from "effect-atom-svelte";
	import { tick } from "svelte";

	import type { EditorModel } from "../editor-model.ts";
	import type {
		LocationPanel,
		MapSelection,
		MapTile,
		PlacementDraft,
	} from "../location-interaction.ts";
	import type { LocationMap } from "../location-map.ts";
	import { farmOccupancyProblem } from "../location-placement.ts";
	import LocationMapViewport from "./LocationMapViewport.svelte";
	import StoragePanel from "./StoragePanel.svelte";

	let { model }: { model: EditorModel } = $props();
	const view = useAtomValue(() => model.atomBindings.view);
	let selectedId = $state("");
	let search = $state("");
	let map = $state.raw<LocationMap>();
	let mapStatus = $state("");
	let viewport = $state<ReturnType<typeof LocationMapViewport>>();
	let panel = $state.raw<LocationPanel>({ kind: "inspector" });
	let draft = $state.raw<
		(PlacementDraft & { readonly revision: number }) | null
	>(null);
	let moving = $state(false);
	let moveError = $state("");
	let dropOutside = $state(false);
	let contentsButton = $state<HTMLButtonElement>();
	let backButton = $state<HTMLButtonElement>();

	let selected = $state.raw<{
		location: NonNullable<typeof location>;
		target: MapSelection;
	}>();

	// Start on a mapped farm when possible, so opening Locations shows the
	// viewport without requiring a trip through the full location list.
	const locations = $derived(view.current?.locations ?? []);
	const location = $derived(
		locations.find((row) => row.id === selectedId) ??
			locations.find((row) => row.farmMap !== undefined) ??
			locations[0],
	);
	const farmMap = $derived(location?.farmMap);
	$effect(() => {
		const name = farmMap;
		map = undefined;
		mapStatus = "";
		if (name === undefined) return;

		// Switching locations cancels pending reads and prevents a late result
		// from replacing the map or status for the newly selected location.
		const controller = new AbortController();
		const { signal } = controller;
		mapStatus = "Loading map…";
		void import("../location-map.ts")
			.then(({ loadFarmMap }) => loadFarmMap(name, signal))
			.then((result) => {
				if (!signal.aborted) {
					map = result;
					mapStatus = "";
				}
			})
			.catch((error: unknown) => {
				if (!signal.aborted)
					mapStatus =
						error instanceof Error ? error.message : "Could not load the map.";
			});

		return () => controller.abort();
	});

	// General object indexes are projection-local. A direct chest can survive
	// slot edits and Undo because Storage owns its path and the tile still
	// identifies the same placed record at that path.
	const selection = $derived.by(() => {
		if (!selected || !location) return null;
		if (selected.location === location) return selected.target;
		if (
			selected.target.kind !== "object" ||
			selected.location.id !== location.id
		)
			return null;
		const index = selected.target.objectIndex;
		const source = selected.location.objects.find(
			(object) => object.index === index,
		);
		const current = location.objects.find((object) => object.index === index);
		return source?.chestOwnerId !== undefined &&
			source.chestOwnerId === current?.chestOwnerId &&
			source.x === current.x &&
			source.y === current.y
			? selected.target
			: null;
	});
	const selectedObject = $derived(
		selection?.kind === "object"
			? location?.objects.find(
					(object) => object.index === selection.objectIndex,
				)
			: undefined,
	);
	const tileObjects = $derived(
		selection?.kind === "tile"
			? (location?.objects.filter(
					({ x, y }) => x === selection.tile.x && y === selection.tile.y,
				) ?? [])
			: [],
	);

	// Let Storage decide whether the exact selected owner has editable slots.
	const chest = $derived(
		view.current?.chests.find(
			(owner) => owner.ownerId === selectedObject?.chestOwnerId,
		),
	);
	const openChest = $derived(
		panel.kind === "contents" && panel.container === selection
			? chest
			: undefined,
	);

	const placement = $derived(
		draft?.source === selection && draft?.revision === view.current?.revision
			? draft
			: null,
	);
	const movable = $derived(
		map !== undefined &&
			selectedObject?.movable === true &&
			selectedObject.x !== undefined &&
			selectedObject.y !== undefined &&
			location?.farmOccupancy?.incomplete === false,
	);
	const placementProblem = $derived(
		placement?.candidate ? destinationProblem(placement.candidate) : undefined,
	);

	function destinationProblem(tile: MapTile) {
		if (
			!map ||
			!location?.farmOccupancy ||
			tile.x < 0 ||
			tile.y < 0 ||
			tile.x >= map.width ||
			tile.y >= map.height
		)
			return "Choose a tile inside the farm.";
		if (!map.placement.has(tile.y * map.width + tile.x))
			return "The farm map blocks that tile.";
		return farmOccupancyProblem(location.farmOccupancy, tile);
	}

	function beginMove() {
		// Both gestures bind the current object and revision before picking tiles.
		const revision = view.current?.revision;
		if (!movable || selection?.kind !== "object" || revision === undefined)
			return;
		moveError = "";
		dropOutside = false;
		draft = { source: selection, candidate: null, revision };
	}

	function pickDestination(tile: MapTile | null) {
		if (!placement || moving) return;
		moveError = "";
		dropOutside = false;
		draft = { ...placement, candidate: tile };
	}

	async function confirmMove() {
		const active = placement;
		const destination = active?.candidate;
		const { x, y } = selectedObject ?? {};
		if (
			!active ||
			!destination ||
			x === undefined ||
			y === undefined ||
			moving ||
			destinationProblem(destination) !== undefined
		)
			return;

		// The queued transaction owns the only write. Keep the preview on
		// failure so the user can choose a different target or cancel.
		moving = true;
		try {
			const result = await model.commands.execute(
				[
					{
						type: "farm-chest-move",
						locationIndex: Number(active.source.locationId),
						objectIndex: active.source.objectIndex,
						source: { x, y },
						destination,
					},
				],
				active.revision,
			);
			if (!result || Result.isFailure(result)) {
				moveError = result
					? result.failure.message
					: "The chest could not be moved.";
				return;
			}
			draft = null;
			await tick();
			// The entry keeps its index. Rebind selection to the committed projection.
			select(active.source);
		} finally {
			moving = false;
		}
	}

	function dropDestination(tile: MapTile | null) {
		pickDestination(tile);
		// A missed drop leaves the same draft active for tap-to-retry.
		dropOutside = tile === null;
		void confirmMove();
	}

	function cancelMove() {
		draft = null;
		moveError = "";
		dropOutside = false;
	}

	async function showContents() {
		if (selection?.kind !== "object" || !chest?.supported) return;
		panel = { kind: "contents", container: selection };
		await tick();
		backButton?.focus();
	}

	async function closeContents() {
		// Finish any focused slot edit before removing its controls.
		await model.edits.endActive();
		panel = { kind: "inspector" };
		await tick();
		contentsButton?.focus({ preventScroll: true });
	}

	function select(target: MapSelection) {
		if (location) selected = { location, target };
		cancelMove();
		panel = { kind: "inspector" };
	}

	const objects = $derived(
		location?.objects.filter((object) =>
			`${object.name} ${object.type} ${object.x ?? "?"}, ${object.y ?? "?"}`
				.toLowerCase()
				.includes(search.trim().toLowerCase()),
		) ?? [],
	);
</script>

<h1>Locations</h1>

<!-- Keep the viewport mounted while Contents replaces the inspector so its
     camera, asset and selection survive returning from a nested action. -->
<section
	aria-label="Location inspector"
	hidden={openChest !== undefined}
>
	{#if location}
		<label>
			Location
			<select
				class="study-input"
				value={location.id}
				disabled={moving}
				onchange={(event) => {
					selectedId = event.currentTarget.value;
					selected = undefined;
					cancelMove();
				}}
			>
				{#each locations as row (row.id)}
					<option value={row.id}>{row.name}</option>
				{/each}
			</select>
		</label>

		{#if farmMap !== undefined}
			{#if map}
				<LocationMapViewport
					bind:this={viewport}
					{map}
					{location}
					{selection}
					{select}
					{placement}
					{placementProblem}
					{dropOutside}
					{movable}
					{beginMove}
					{pickDestination}
					{dropDestination}
					{cancelMove}
				/>
			{:else}
				<p role="status">{mapStatus}</p>
			{/if}
		{:else if location.farmLayout !== undefined}
			<p>
				No map preview is available for this farm layout ({location.farmLayout ||
					"empty layout ID"}).
			</p>
		{:else}
			<p>This location has no map preview.</p>
		{/if}

		{#if placement}
			<div class="selection">
				<button
					class="study-kit study-button"
					type="button"
					disabled={moving ||
						!placement.candidate ||
						placementProblem !== undefined}
					onclick={() => void confirmMove()}
				>
					Move here
				</button>
				<button
					class="study-kit study-button"
					type="button"
					disabled={moving}
					onclick={cancelMove}
				>
					Cancel
				</button>
			</div>
		{:else if selectedObject || selection?.kind === "tile"}
			<div
				class="selection"
				role="status"
			>
				{#if selectedObject}
					<strong>{selectedObject.name}</strong>
					<span>Tile {selectedObject.x ?? "?"}, {selectedObject.y ?? "?"}</span>
					{#if movable}
						<button
							class="study-kit study-button"
							type="button"
							onclick={() => {
								beginMove();
								viewport?.focusMap();
							}}
						>
							Move
						</button>
					{/if}
					{#if chest?.supported}
						<button
							bind:this={contentsButton}
							class="study-kit study-button"
							type="button"
							onclick={() => void showContents()}
						>
							Contents
						</button>
					{:else if chest?.reason}
						<span>{chest.reason}</span>
					{/if}
				{:else if selection?.kind === "tile"}
					<strong>Tile {selection.tile.x}, {selection.tile.y}</strong>
					{#each tileObjects as object (object.index)}
						<button
							class="study-kit study-button"
							type="button"
							onclick={() =>
								select({
									kind: "object",
									locationId: location.id,
									objectIndex: object.index,
								})}
						>
							{object.name}
						</button>
					{/each}
				{/if}
			</div>
		{/if}

		{#if moveError}<p role="alert">{moveError}</p>{/if}

		{#if location.readable && !placement}
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
								<td>
									<button
										class="study-kit study-button"
										type="button"
										aria-pressed={selectedObject?.index === object.index}
										onclick={() =>
											select({
												kind: "object",
												locationId: location.id,
												objectIndex: object.index,
											})}
									>
										{object.name}
									</button>
								</td>
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
		{:else if !placement}
			<p>This location has no readable placed-object list.</p>
		{/if}
	{:else}
		<p>No saved locations are available.</p>
	{/if}
</section>

{#if openChest}
	<section aria-label="Selected chest contents">
		<button
			bind:this={backButton}
			class="study-kit study-button"
			type="button"
			onclick={() => void closeContents()}
		>
			Back to map
		</button>

		{#key openChest.ownerId}
			<StoragePanel
				{model}
				onlyOwnerId={openChest.ownerId}
			/>
		{/key}
	</section>
{/if}

<style>
	.selection {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
		padding: 8px;
		border: 1px solid #ba8c52;
	}

	button {
		min-height: 44px;
	}

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
		overflow-wrap: break-word;
	}
</style>
