<script lang="ts">
	import { Result } from "effect";
	import { useAtomValue } from "effect-atom-svelte";
	import { tick } from "svelte";

	import type { EditorModel } from "../editor-model.ts";
	import { buildingDestinationTiles } from "../location-building-move.ts";
	import type {
		LocationPanel,
		MapSelection,
		MapTile,
		PlacementDraft,
	} from "../location-interaction.ts";
	import type { LocationMap } from "../location-map.ts";
	import { farmOccupancyProblem } from "../location-placement.ts";
	import {
		areaBetween,
		planFarmRemoval,
		type RemovalGroup,
		removalGroups,
		type TileArea,
	} from "../location-removal.ts";
	import LocationMapViewport from "./LocationMapViewport.svelte";
	import StoragePanel from "./StoragePanel.svelte";

	let { model }: { model: EditorModel } = $props();
	const view = useAtomValue(() => model.atomBindings.view);
	const buildingLabelId = $props.id();
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

	// The rectangle belongs to the map, so applying or closing Remove leaves
	// it available for the next tool. The first corner is only a picking draft.
	let area = $state.raw<TileArea | "farm">();
	let firstCorner = $state.raw<MapTile>();
	let pickingArea = $state(false);
	let groups = $state<RemovalGroup[]>([]);
	let applyingRemoval = $state(false);
	let removalFeedback = $state("");

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
	const removalTargets = $derived(
		!pickingArea && area !== undefined
			? planFarmRemoval(location?.removalTargets ?? [], area, groups)
			: [],
	);
	const targetCounts = $derived(
		removalGroups.map((group) => ({
			...group,
			count: removalTargets.filter((target) => target.group === group.id)
				.length,
		})),
	);
	const areaOverlay = $derived(
		pickingArea
			? firstCorner && areaBetween(firstCorner, firstCorner)
			: area === "farm"
				? map && {
						left: 0,
						top: 0,
						right: map.width - 1,
						bottom: map.height - 1,
					}
				: area,
	);
	const areaPrompt = $derived(
		pickingArea
			? firstCorner
				? "Tap the opposite corner."
				: "Tap the first corner."
			: "",
	);

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
	const selectedBuilding = $derived(
		selection?.kind === "building"
			? location?.buildings?.find(
					(building) => building.index === selection.buildingIndex,
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
			location?.farmOccupancy?.incomplete === false &&
			(selectedBuilding?.doors !== undefined ||
				(selectedObject?.movable === true &&
					selectedObject.x !== undefined &&
					selectedObject.y !== undefined)),
	);
	const placementProblem = $derived(
		placement?.candidate ? destinationProblem(placement.candidate) : undefined,
	);

	function destinationProblem(tile: MapTile) {
		if (!map || !location?.farmOccupancy)
			return "Choose a tile inside the farm.";

		// Both shapes use the same picking interaction. Buildings need buildable
		// ground under their whole footprint and clear approaches at both doors.
		const footprint = selectedBuilding
			? buildingDestinationTiles(selectedBuilding, tile)
			: [{ ...tile, door: false }];
		for (const cell of footprint) {
			if (
				cell.x < 0 ||
				cell.y < 0 ||
				cell.x >= map.width ||
				cell.y >= map.height
			)
				return "The destination must fit on the farm.";
			const allowed =
				selectedBuilding && !cell.door ? map.buildable : map.placement;
			if (!allowed.has(cell.y * map.width + cell.x))
				return cell.door
					? `Door approach (${cell.x}, ${cell.y}) is blocked by the map.`
					: `Tile (${cell.x}, ${cell.y}) is blocked by the farm map.`;
			const occupied = farmOccupancyProblem(
				location.farmOccupancy,
				cell,
				selectedBuilding?.index,
				cell.door,
			);
			if (occupied !== undefined) return occupied;
		}
		return undefined;
	}

	function beginMove() {
		// Both gestures bind the current object and revision before picking tiles.
		const revision = view.current?.revision;
		if (
			!movable ||
			!selection ||
			selection.kind === "tile" ||
			revision === undefined
		)
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
		const { x, y } = selectedBuilding ?? selectedObject ?? {};
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
					active.source.kind === "building"
						? {
								type: "farm-coop-move",
								locationIndex: Number(active.source.locationId),
								buildingIndex: active.source.buildingIndex,
								source: { x, y },
								destination,
							}
						: {
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
					: "The move could not be applied.";
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

	function beginArea() {
		// Every swipe still belongs to the camera. Only deliberate tile taps
		// advance the two-corner picker.
		firstCorner = undefined;
		pickingArea = true;
		removalFeedback = "";
		selected = undefined;
		viewport?.focusMap();
	}

	function pickAreaTile(tile: MapTile) {
		if (!pickingArea) return;
		if (!firstCorner) {
			firstCorner = tile;
			return;
		}
		area = areaBetween(firstCorner, tile);
		firstCorner = undefined;
		pickingArea = false;
	}

	function cancelAreaPick() {
		firstCorner = undefined;
		pickingArea = false;
	}

	async function applyRemoval() {
		const revision = view.current?.revision;
		const scope = area;
		const count = removalTargets.length;
		if (
			!location ||
			scope === undefined ||
			revision === undefined ||
			count === 0 ||
			applyingRemoval
		)
			return;
		// Reject a changed revision so Apply always matches the visible preview.
		applyingRemoval = true;
		removalFeedback = "";
		try {
			const result = await model.commands.execute(
				[
					{
						type: "farm-obstacles-remove",
						locationIndex: Number(location.id),
						scope,
						groups: [...groups],
					},
				],
				revision,
			);
			if (result && Result.isSuccess(result)) {
				removalFeedback = `Removed ${count} ${count === 1 ? "obstacle" : "obstacles"}.`;
			} else if (result) removalFeedback = result.failure.message;
		} finally {
			applyingRemoval = false;
		}
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
		// An object or tile becomes the active context when picked outside
		// the area tool. Cancelling or applying Remove never calls this path.
		area = undefined;
		removalFeedback = "";
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
				disabled={moving || applyingRemoval}
				onchange={(event) => {
					selectedId = event.currentTarget.value;
					selected = undefined;
					cancelMove();
					area = undefined;
					groups = [];
					removalFeedback = "";
					cancelAreaPick();
				}}
			>
				{#each locations as row (row.id)}
					<option value={row.id}>{row.name}</option>
				{/each}
			</select>
		</label>

		{#if farmMap !== undefined}
			{#if map}
				{#if location.buildings?.length}
					<label>
						<span id={buildingLabelId}>Find a farm building</span>
						<select
							aria-labelledby={buildingLabelId}
							class="study-input"
							value={selectedBuilding?.index ?? ""}
							disabled={placement !== null || pickingArea || applyingRemoval}
							onchange={(event) => {
								const { value } = event.currentTarget;
								if (value !== "")
									select({
										kind: "building",
										locationId: location.id,
										buildingIndex: Number(value),
									});
							}}
						>
							<option
								value=""
								disabled
							>
								Choose a building
							</option>
							{#each location.buildings as building (building.index)}
								<option value={building.index}>
									{building.name} ({building.x}, {building.y})
								</option>
							{/each}
						</select>
					</label>
				{/if}
				{#if location.removalTargets !== undefined}
					<!-- Keep toolbar height stable during a captured chest drag so
					     the viewport does not move under the pointer. -->
					<div
						class="selection"
						role="group"
						aria-label="Area tools"
					>
						{#if !pickingArea}
							<button
								class="study-kit study-button"
								type="button"
								disabled={applyingRemoval || placement !== null}
								onclick={beginArea}
							>
								{area && area !== "farm" ? "Adjust area" : "Select area"}
							</button>
							{#if area !== "farm"}
								<button
									class="study-kit study-button"
									type="button"
									disabled={applyingRemoval || placement !== null}
									onclick={() => {
										area = "farm";
										selected = undefined;
										removalFeedback = "";
									}}
								>
									Select entire farm
								</button>
							{/if}
						{/if}
						{#if area && !pickingArea}
							<strong>
								{area === "farm"
									? "Entire farm selected"
									: `${area.right - area.left + 1} × ${area.bottom - area.top + 1} tiles selected`}
							</strong>
							<button
								class="study-kit study-button"
								type="button"
								disabled={applyingRemoval || placement !== null}
								onclick={() => {
									area = undefined;
									removalFeedback = "";
								}}
							>
								Clear selection
							</button>
						{/if}
						{#if pickingArea}
							<button
								class="study-kit study-button"
								type="button"
								onclick={cancelAreaPick}
							>
								Cancel selection
							</button>
						{/if}
					</div>
				{/if}
				<LocationMapViewport
					bind:this={viewport}
					{map}
					{location}
					{selection}
					select={(target) => {
						if (!applyingRemoval && !pickingArea) select(target);
					}}
					area={areaOverlay}
					{areaPrompt}
					{pickingArea}
					{pickAreaTile}
					{removalTargets}
					{placement}
					{placementProblem}
					{dropOutside}
					movable={movable && !pickingArea}
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
		{:else if selectedObject || selectedBuilding || selection?.kind === "tile"}
			<div
				class="selection"
				role="status"
			>
				{#if selectedObject}
					<strong>{selectedObject.name}</strong>
					<span>Tile {selectedObject.x ?? "?"}, {selectedObject.y ?? "?"}</span>

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
				{:else if selectedBuilding}
					<strong>{selectedBuilding.name}</strong>
					<span>Tile {selectedBuilding.x}, {selectedBuilding.y}</span>
					<span>
						{selectedBuilding.width} × {selectedBuilding.height} tiles
					</span>
					{#if movable}
						<span>Keep both door approaches clear.</span>
					{:else}
						<span>
							{selectedBuilding.moveReason ??
								"Some saved obstacles have unknown footprints."}
						</span>
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
				{#if movable || selectedBuilding}
					<button
						disabled={!movable}
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
			</div>
		{/if}

		{#if moveError}<p role="alert">{moveError}</p>{/if}

		{#if map && location.removalTargets !== undefined && !placement}
			<section
				class="selection"
				aria-label="Remove obstacles"
			>
				<fieldset
					disabled={area === undefined || pickingArea || applyingRemoval}
				>
					<legend>Remove obstacles</legend>
					{#each targetCounts as group (group.id)}
						<label>
							<input
								type="checkbox"
								value={group.id}
								bind:group={groups}
								onchange={() => {
									removalFeedback = "";
								}}
							/>
							{group.label}{groups.includes(group.id)
								? ` (${group.count})`
								: ""}
						</label>
					{/each}
				</fieldset>
				<p role="status">
					{#if pickingArea || area === undefined}
						Select an area or the entire farm to preview removals.
					{:else}
						{removalFeedback ||
							`${removalTargets.length} selected for removal.`}
					{/if}
				</p>
				<button
					class="study-kit study-button"
					type="button"
					disabled={applyingRemoval || removalTargets.length === 0}
					onclick={() => void applyRemoval()}
				>
					{applyingRemoval ? "Reclaiming…" : "Reclaim"}
				</button>
			</section>
		{/if}

		{#if location.readable && !placement && !pickingArea && area === undefined}
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
		{:else if !placement && !pickingArea && area === undefined}
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
