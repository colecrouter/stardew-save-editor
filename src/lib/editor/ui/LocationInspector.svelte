<script lang="ts">
	import { Result } from "effect";
	import { useAtomValue } from "effect-atom-svelte";
	import { tick } from "svelte";

	import { asset } from "$app/paths";
	import { uiAtlases } from "$lib/ui/uiAssets.ts";

	import type { EditorModel } from "../editor-model.ts";
	import { buildingDestinationTiles } from "../location-building-move.ts";
	import {
		type FlooringFillMode,
		flooringMaterialName,
		flooringMaterials,
		flooringSourceChoices,
		planFlooringPlacement,
	} from "../location-flooring.ts";
	import { furnitureAtTile } from "../location-inspection.ts";
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
	import { loadFloorSwatches } from "../location-terrain.ts";
	import LocationMapViewport from "./LocationMapViewport.svelte";
	import LocationSpriteButton from "./LocationSpriteButton.svelte";
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

	// An explicit area and a normal tile tap both feed the same area commands.
	// Keep the tapped tile through revisions even if its inspected object is removed.
	let area = $state.raw<TileArea | "farm">();
	let singleTile = $state.raw<MapTile>();
	const areaScope = $derived(
		area ?? (singleTile && areaBetween(singleTile, singleTile)),
	);
	let firstCorner = $state.raw<MapTile>();
	let pickingArea = $state(false);
	let groups = $state<RemovalGroup[]>([]);
	let applyingRemoval = $state(false);
	let areaTool = $state<"reclaim" | "place">("reclaim");
	let chosenFromFloor = $state("");
	let toFloor = $state("");
	let placeMode = $state<"empty" | "overwrite" | "replace">("empty");
	const placeModes = [
		{ id: "empty", label: "Empty tiles" },
		{ id: "overwrite", label: "Overwrite flooring" },
		{ id: "replace", label: "Replace only" },
	] as const;
	let fillMode = $state<FlooringFillMode>("area");
	const fillModes = [
		{ id: "area", label: "Whole selection" },
		{ id: "perimeter", label: "Perimeter" },
	] as const;
	let applyingFlooring = $state(false);
	const applyingAreaEdit = $derived(applyingRemoval || applyingFlooring);

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
	// Count only flooring inside the current selection, auto-selecting the
	// source when the player has exactly one supported material to choose from.
	const sourceChoices = $derived(
		areaScope === undefined || placeMode !== "replace" || !map
			? []
			: flooringSourceChoices(
					location?.terrain ?? [],
					areaScope === "farm"
						? { left: 0, top: 0, right: map.width - 1, bottom: map.height - 1 }
						: areaScope,
					fillMode,
				),
	);
	const fromFloor = $derived(
		chosenFromFloor ||
			(sourceChoices.length === 1 ? (sourceChoices[0]?.id ?? "") : ""),
	);
	// Count every category for the palette, but highlight only active toggles.
	const availableRemoval = $derived(
		areaTool === "reclaim" && !pickingArea && areaScope !== undefined
			? planFarmRemoval(
					location?.removalTargets ?? [],
					areaScope,
					removalGroups.map(({ id }) => id),
				)
			: [],
	);
	const removalTargets = $derived(
		availableRemoval.filter(({ group }) => groups.includes(group)),
	);
	const removalSprites = {
		debris: {
			url: asset(uiAtlases.objects.path),
			x: 96,
			y: 256,
			width: 16,
			height: 16,
		},
		grass: {
			url: "/content/TerrainFeatures/grass.png",
			x: 0,
			y: 0,
			width: 15,
			height: 20,
		},
		trees: {
			url: "/content/TerrainFeatures/tree1_spring.png",
			x: 0,
			y: 0,
			width: 48,
			height: 96,
		},
	};
	// All modes preview the exact tiles that the same command will apply.
	const flooringPreview = $derived(
		areaTool === "place" &&
			!pickingArea &&
			areaScope !== undefined &&
			map &&
			location?.farmOccupancy
			? planFlooringPlacement(
					map,
					location.farmOccupancy,
					location.terrain ?? [],
					areaScope,
					toFloor,
					placeMode === "replace"
						? { kind: "replace", from: fromFloor }
						: { kind: placeMode },
					fillMode,
				)
			: { tiles: [], blocked: 0 },
	);
	const replacements = $derived(
		flooringPreview.tiles.filter(({ previous }) => previous !== undefined)
			.length,
	);
	const additions = $derived(flooringPreview.tiles.length - replacements);
	const targetCounts = $derived(
		removalGroups.map((group) => ({
			...group,
			count: availableRemoval.filter((target) => target.group === group.id)
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
				: (area ??
					(!selected && singleTile
						? areaBetween(singleTile, singleTile)
						: undefined)),
	);
	const areaPrompt = $derived(
		pickingArea
			? firstCorner
				? "Tap the opposite corner."
				: "Tap the first corner."
			: "",
	);

	let floorSwatches =
		$state.raw<Awaited<ReturnType<typeof loadFloorSwatches>>>();
	$effect(() => {
		if (farmMap === undefined) return;
		const request = new AbortController();
		// Missing workspace art leaves both the map and named controls usable.
		void loadFloorSwatches(request.signal)
			.then((swatches) => {
				if (!request.signal.aborted) floorSwatches = swatches;
			})
			.catch(() => {});
		return () => request.abort();
	});

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
		if (selected.location.id !== location.id) return null;
		// Tile coordinates survive material changes and Undo. If the inspected
		// record vanished, keep the selection on the tile the player picked.
		if (selected.target.kind === "tile") return selected.target;
		const tappedTile = singleTile
			? { kind: "tile" as const, locationId: location.id, tile: singleTile }
			: null;
		if (selected.target.kind !== "object") return tappedTile;
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
			: tappedTile;
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

	// A building roof tap can hit outside its footprint. Use the actual tap
	// for tile inspection while Move continues to use the saved anchor.
	const inspectionTile = $derived.by(() => {
		if (selection?.kind === "tile") return selection.tile;
		if (selection?.kind === "building")
			return selection.tile ?? selectedBuilding;
		const { x, y } = selectedObject ?? {};
		return x === undefined || y === undefined ? undefined : { x, y };
	});
	// Offer every other saved object on the inspected tile from the same panel.
	const tileObjects = $derived(
		inspectionTile
			? (location?.objects.filter(
					({ index, x, y }) =>
						index !== selectedObject?.index &&
						x === inspectionTile.x &&
						y === inspectionTile.y,
				) ?? [])
			: [],
	);
	const tileBuildings = $derived(
		inspectionTile
			? (location?.buildings ?? []).filter(
					(building) =>
						building.index !== selectedBuilding?.index &&
						inspectionTile.x >= building.x &&
						inspectionTile.x < building.x + building.width &&
						inspectionTile.y >= building.y &&
						inspectionTile.y < building.y + building.height,
				)
			: [],
	);
	const selectedTerrain = $derived(
		inspectionTile
			? (location?.terrain ?? []).filter(
					(marker) =>
						inspectionTile.x >= marker.x &&
						inspectionTile.x < marker.x + marker.width &&
						inspectionTile.y >= marker.y &&
						inspectionTile.y < marker.y + marker.height,
				)
			: [],
	);
	// Match the viewport's furniture hit region, including overhanging art.
	const tileFurniture = $derived(
		inspectionTile
			? furnitureAtTile(location?.furniture ?? [], inspectionTile)
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
		singleTile = undefined;
		chosenFromFloor = "";
		firstCorner = undefined;
		pickingArea = false;
	}

	function cancelAreaPick() {
		firstCorner = undefined;
		pickingArea = false;
	}

	async function applyRemoval() {
		const revision = view.current?.revision;
		const scope = areaScope;
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
				model.showNotice(
					`Removed ${count} ${count === 1 ? "obstacle" : "obstacles"}.`,
					"success",
				);
			} else if (result) model.showNotice(result.failure.message, "error");
		} finally {
			applyingRemoval = false;
		}
	}

	async function placeFlooring() {
		const revision = view.current?.revision;
		const { tiles } = flooringPreview;
		if (
			!location ||
			revision === undefined ||
			tiles.length === 0 ||
			applyingAreaEdit
		)
			return;

		// Bind additions and replacements to the same revision and Undo entry.
		applyingFlooring = true;
		if (placeMode === "replace") chosenFromFloor = fromFloor;
		try {
			const result = await model.commands.execute(
				[
					{
						type: "farm-flooring-place",
						locationIndex: Number(location.id),
						material: toFloor,
						tiles,
					},
				],
				revision,
			);
			if (result && Result.isSuccess(result))
				model.showNotice(
					`Placed flooring on ${tiles.length} ${tiles.length === 1 ? "tile" : "tiles"}.`,
					"success",
				);
			else if (result) model.showNotice(result.failure.message, "error");
		} finally {
			applyingFlooring = false;
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
		// A tap changes the inspected record and supplies one tile to both
		// area actions. Keep explicit rectangles reserved for the area picker.
		area = undefined;
		chosenFromFloor = "";
		const point =
			target.kind === "tile"
				? target.tile
				: target.kind === "building"
					? (target.tile ??
						location?.buildings?.find(
							(building) => building.index === target.buildingIndex,
						))
					: location?.objects.find(
							(object) => object.index === target.objectIndex,
						);
		const { x, y } = point ?? {};
		singleTile =
			map &&
			x !== undefined &&
			y !== undefined &&
			[x, y].every(Number.isInteger) &&
			x >= 0 &&
			y >= 0 &&
			x < map.width &&
			y < map.height
				? { x, y }
				: undefined;
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

{#snippet materialButton(
	material: { id: string; name: string },
	pressed: boolean,
	disabled: boolean,
	choose: () => void,
	count?: number,
)}
	{@const swatch = floorSwatches?.get(material.id)}
	<LocationSpriteButton
		name={count === undefined ? material.name : `${material.name} (${count})`}
		{pressed}
		{disabled}
		{choose}
		sprite={swatch && {
			...swatch,
			url: "/content/TerrainFeatures/Flooring.png",
			width: 16,
			height: 16,
		}}
		fallback={material.id}
	/>
{/snippet}

{#snippet destinationPalette(
	value: string,
	excluded: string,
	choose: (id: string) => void,
)}
	<div class="sprite-palette">
		{#each flooringMaterials as material (material.id)}
			{@render materialButton(
				material,
				value === material.id,
				material.id === excluded,
				() => choose(material.id),
			)}
		{/each}
	</div>
{/snippet}

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
				disabled={moving || applyingAreaEdit}
				onchange={(event) => {
					selectedId = event.currentTarget.value;
					selected = undefined;
					cancelMove();
					area = undefined;
					singleTile = undefined;
					chosenFromFloor = "";
					groups = [];
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
							disabled={placement !== null || pickingArea || applyingAreaEdit}
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
								disabled={applyingAreaEdit || placement !== null}
								onclick={beginArea}
							>
								{area && area !== "farm" ? "Adjust area" : "Select area"}
							</button>
							{#if area !== "farm"}
								<button
									class="study-kit study-button"
									type="button"
									disabled={applyingAreaEdit || placement !== null}
									onclick={() => {
										area = "farm";
										singleTile = undefined;
										chosenFromFloor = "";
										selected = undefined;
									}}
								>
									Select entire farm
								</button>
							{/if}
						{/if}
						{#if areaScope && !pickingArea}
							<strong>
								{areaScope === "farm"
									? "Entire farm selected"
									: singleTile
										? `Tile ${singleTile.x}, ${singleTile.y} selected`
										: `${areaScope.right - areaScope.left + 1} × ${areaScope.bottom - areaScope.top + 1} tiles selected`}
							</strong>
							<button
								class="study-kit study-button"
								type="button"
								disabled={applyingAreaEdit || placement !== null}
								onclick={() => {
									area = undefined;
									singleTile = undefined;
									selected = undefined;
									chosenFromFloor = "";
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
						if (!applyingAreaEdit && !pickingArea) select(target);
					}}
					area={areaOverlay}
					{areaPrompt}
					{pickingArea}
					{pickAreaTile}
					{removalTargets}
					flooringTargets={flooringPreview.tiles}
					{floorSwatches}
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
				{/if}

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
				<!-- A placed-object selection can jump to a building on the same
				     tile without opening the tile inspector first. -->
				{#if inspectionTile}
					{#each tileBuildings as building (building.index)}
						<button
							class="study-kit study-button"
							type="button"
							onclick={() =>
								select({
									kind: "building",
									locationId: location.id,
									buildingIndex: building.index,
									tile: inspectionTile,
								})}
						>
							{building.name}
						</button>
					{/each}
				{/if}

				<!-- Keep the shared tile details in the current selection so
				     inspecting an object never adds a second navigation step. -->
				{#each tileFurniture as item (item.index)}
					<span>{item.name} · {item.width} × {item.height} tiles</span>
				{/each}

				{#each selectedTerrain as marker (marker.id)}
					<span>
						{flooringMaterialName(marker.material) ??
							(marker.material === undefined
								? marker.label
								: `Flooring (material ${marker.material})`)}
					</span>
				{/each}
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
			<div
				class="selection"
				role="group"
				aria-label="Area action"
			>
				<button
					class="study-kit study-button area-mode-button"
					type="button"
					aria-pressed={areaTool === "reclaim"}
					disabled={applyingAreaEdit}
					onclick={() => (areaTool = "reclaim")}
				>
					Remove obstacles
				</button>

				<button
					class="study-kit study-button area-mode-button"
					type="button"
					aria-pressed={areaTool === "place"}
					disabled={applyingAreaEdit}
					onclick={() => (areaTool = "place")}
				>
					Place
				</button>
			</div>

			{#if areaTool === "reclaim"}
				<section
					class="selection area-action-panel"
					aria-label="Remove obstacles"
				>
					<fieldset
						class="area-action-palette"
						disabled={areaScope === undefined ||
							pickingArea ||
							applyingAreaEdit}
					>
						<legend>Remove obstacles</legend>
						<div class="sprite-palette">
							{#each targetCounts as group (group.id)}
								<LocationSpriteButton
									name={`${group.label} (${group.count})`}
									pressed={groups.includes(group.id)}
									sprite={removalSprites[group.id]}
									fallback={group.label.slice(0, 1)}
									choose={() => {
										groups = groups.includes(group.id)
											? groups.filter((id) => id !== group.id)
											: [...groups, group.id];
									}}
								/>
							{/each}
						</div>

						{#if groups.length > 0}
							<p class="palette-summary">
								{targetCounts
									.filter(({ id }) => groups.includes(id))
									.map(({ label, count }) => `${label} (${count})`)
									.join(" · ")}
							</p>
						{/if}
					</fieldset>
					<div class="area-action-footer">
						<p
							class="area-action-status"
							role="status"
						>
							{#if pickingArea || areaScope === undefined}
								Select a tile or area to preview removals.
							{:else if groups.length === 0}
								Choose obstacles to remove.
							{:else if removalTargets.length === 0}
								No matching obstacles in this selection.
							{:else}
								{removalTargets.length} selected for removal.
							{/if}
						</p>

						<button
							class="study-kit study-button area-action-apply"
							type="button"
							disabled={applyingRemoval || removalTargets.length === 0}
							onclick={() => void applyRemoval()}
						>
							{applyingRemoval ? "Reclaiming…" : "Reclaim"}
						</button>
					</div>
				</section>
			{:else}
				<section
					class="selection area-action-panel"
					aria-label="Place flooring"
				>
					<fieldset
						class="area-action-palette"
						disabled={areaScope === undefined ||
							pickingArea ||
							applyingAreaEdit}
					>
						<legend>Place flooring</legend>

						<fieldset class="material-group">
							<legend>Placement behavior</legend>

							<div class="sprite-palette">
								{#each placeModes as mode (mode.id)}
									<button
										class="study-kit study-button area-mode-button"
										type="button"
										aria-pressed={placeMode === mode.id}
										onclick={() => (placeMode = mode.id)}
									>
										{mode.label}
									</button>
								{/each}
							</div>
						</fieldset>

						<fieldset class="material-group">
							<legend>Pattern</legend>

							<div class="sprite-palette">
								{#each fillModes as mode (mode.id)}
									<button
										class="study-kit study-button area-mode-button"
										type="button"
										aria-pressed={fillMode === mode.id}
										onclick={() => {
											fillMode = mode.id;
											chosenFromFloor = "";
										}}
									>
										{mode.label}
									</button>
								{/each}
							</div>
						</fieldset>

						{#if placeMode === "replace" && sourceChoices.length > 0}
							{@const source = sourceChoices.find(({ id }) => id === fromFloor)}
							<fieldset class="material-group">
								<legend>Replace material</legend>

								<div class="sprite-palette">
									{#each sourceChoices as material (material.id)}
										{@render materialButton(
											material,
											fromFloor === material.id,
											false,
											() => {
												chosenFromFloor = material.id;
												if (toFloor === material.id) toFloor = "";
											},
											material.count,
										)}
									{/each}
								</div>

								{#if source}
									<p class="palette-summary">{source.name} ({source.count})</p>
								{/if}
							</fieldset>
						{/if}

						<fieldset class="material-group">
							<legend>Material to place</legend>

							{@render destinationPalette(
								toFloor,
								placeMode === "replace" ? fromFloor : "",
								(id) => {
									toFloor = id;
								},
							)}

							{#if toFloor !== ""}
								<p class="palette-summary">{flooringMaterialName(toFloor)}</p>
							{/if}
						</fieldset>
					</fieldset>

					<!-- Keep the preview in the footer so it never wraps alongside the palette. -->
					<div class="area-action-footer">
						<p
							class="area-action-status"
							role="status"
						>
							{#if pickingArea || areaScope === undefined}
								Select a tile or area to preview flooring placement.
							{:else if location.farmOccupancy?.incomplete}
								Some saved objects have unknown footprints.
							{:else if placeMode === "replace" && sourceChoices.length === 0}
								No supported flooring matches the selection pattern.
							{:else if placeMode === "replace" && fromFloor === ""}
								Choose the material to replace.
							{:else if toFloor === ""}
								Choose a material to place.
							{:else if placeMode === "replace" && fromFloor === toFloor}
								Choose a different replacement material.
							{:else}
								{#if additions > 0}
									<span class="preview-add">{additions} to add</span>
								{/if}
								{#if replacements > 0}
									<span class="preview-replace">{replacements} to replace</span>
								{/if}
								{#if flooringPreview.blocked > 0}
									<span>{flooringPreview.blocked} blocked</span>
								{/if}
								{#if flooringPreview.tiles.length === 0 && flooringPreview.blocked === 0}
									No flooring changes in this selection.
								{/if}
							{/if}
						</p>

						<button
							class="study-kit study-button area-action-apply"
							type="button"
							disabled={applyingAreaEdit || flooringPreview.tiles.length === 0}
							onclick={() => void placeFlooring()}
						>
							{applyingFlooring ? "Placing…" : "Place flooring"}
						</button>
					</div>
				</section>
			{/if}
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

	.area-action-panel {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		container-type: inline-size;
	}

	.area-action-footer {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 8px 12px;
		padding-top: 8px;
		border-top: 1px solid #ba8c52;
	}

	.area-action-status {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 12px;
		margin: 0;
		font-size: 0.85rem;
	}

	.area-action-status span,
	.area-action-apply {
		white-space: nowrap;
	}

	/* A narrow panel gives the summary its own row and keeps the action
	   full width. Preview counts can change without squeezing the button. */
	@container (max-width: 28rem) {
		.area-action-footer {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	.area-action-palette {
		min-inline-size: 0;
	}

	.material-group {
		border: 0;
		margin: 0 0 8px;
		padding: 0;
		min-inline-size: 0;
	}

	.sprite-palette {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	/* Change the pressed surface within the existing button bounds so mode
	   changes keep the palette and preview controls in place. */
	.area-mode-button[aria-pressed="true"] {
		--button-ink: #183e3a;
		--button-border: #37797c;
		--button-surface: #d4e9df;
		--button-hover: #e2f2e9;
		--button-top: #b5d2c8;
		--button-bottom: #92bab0;
	}

	/* Match the preview colors while keeping the text readable on the panel. */
	.preview-add {
		border-bottom: 3px solid #35bdc2;
	}

	.preview-replace {
		border-bottom: 3px solid #ba67d2;
	}

	.palette-summary {
		margin: 6px 0 0;
		font-size: 0.85rem;
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
