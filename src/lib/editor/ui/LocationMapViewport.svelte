<script lang="ts">
	import { onMount, untrack } from "svelte";
	import { on } from "svelte/events";
	import { SvelteMap } from "svelte/reactivity";

	import { asset } from "$app/paths";
	import { readBuildingSprite } from "$lib/ui/building-sprite.ts";
	import { uiAtlases } from "$lib/ui/uiAssets.ts";

	import type { FlooringPlacementTile } from "../location-flooring.ts";
	import {
		furnitureAtTile,
		type LocationInspection,
	} from "../location-inspection.ts";
	import {
		type MapCamera,
		type MapSelection,
		type MapTile,
		type PlacementDraft,
		tileToViewport,
		type ViewportPoint,
		viewportToTile,
		zoomAt,
	} from "../location-interaction.ts";
	import type { LocationMap } from "../location-map.ts";
	import type { RemovalTarget, TileArea } from "../location-removal.ts";
	import {
		loadFloorSwatches,
		type TerrainMarker,
	} from "../location-terrain.ts";
	import type { WorldFrame } from "../location-world-art.ts";
	import BackpackItemVisual from "./BackpackItemVisual.svelte";

	let {
		map,
		location,
		selection,
		select,
		placement,
		placementProblem,
		dropOutside,
		area,
		areaPrompt,
		pickingArea,
		pickAreaTile,
		removalTargets,
		flooringTargets,
		floorSwatches,
		movable,
		beginMove,
		pickDestination,
		dropDestination,
		cancelMove,
	}: {
		map: LocationMap;
		location: LocationInspection;
		selection: MapSelection | null;
		select: (target: MapSelection) => void;
		placement: PlacementDraft | null;
		placementProblem: string | undefined;
		dropOutside: boolean;
		area: TileArea | undefined;
		areaPrompt: string;
		pickingArea: boolean;
		pickAreaTile: (tile: MapTile) => void;
		removalTargets: readonly RemovalTarget[];
		flooringTargets: readonly FlooringPlacementTile[];
		floorSwatches: ReadonlyMap<string, { x: number; y: number }> | undefined;
		movable: boolean;
		beginMove: () => void;
		pickDestination: (tile: MapTile | null) => void;
		dropDestination: (tile: MapTile | null) => void;
		cancelMove: () => void;
	} = $props();

	let viewport: HTMLDivElement;
	let background: HTMLCanvasElement;
	let camera = $state<MapCamera>({ origin: { x: 0, y: 0 }, pixelsPerTile: 12 });
	const pointers = new SvelteMap<number, ViewportPoint>();
	let tapOrigin: ViewportPoint | undefined;
	let areaCursor = $state.raw<MapTile>();
	$effect(() => {
		if (!pickingArea) areaCursor = undefined;
	});
	let drag = $state<{
		pointerId: number;
		start: ViewportPoint;
		started: boolean;
	}>();
	const furnitureSheet = asset("assets/furniture.png");
	const craftableSheet = asset(uiAtlases.craftables.path);
	const scale = $derived(camera.pixelsPerTile / map.tileSize);
	// Keep only records with usable tile keys on the map. Every record remains
	// available in the list, including duplicates and incomplete coordinates.
	const markers = $derived(
		location.objects.flatMap((object) => {
			const { x, y } = object;
			return x !== undefined &&
				y !== undefined &&
				Number.isInteger(x) &&
				Number.isInteger(y) &&
				x >= 0 &&
				y >= 0 &&
				x < map.width &&
				y < map.height
				? [{ object, x, y, frame: objectFrame(object) }]
				: [];
		}),
	);
	/** The inventory atlas carries the idle world frame for simple craftables. */
	function objectFrame(
		object: LocationInspection["objects"][number],
	): WorldFrame | undefined {
		if (object.worldFrame) return object.worldFrame;
		const visual = object.visual;
		if (
			visual?.sheet !== "Craftables.png" ||
			visual.layers.length !== 1 ||
			visual.layers[0]?.tint !== undefined ||
			visual.sourceRect.width !== 16 ||
			visual.sourceRect.height !== 32
		)
			return undefined;
		const { x, y, width, height } = visual.sourceRect;
		return {
			url: craftableSheet,
			sourceX: x,
			sourceY: y,
			width,
			height,
			offsetX: 0,
			offsetY: -1,
		};
	}
	// Saved terrain is separate from both the base raster and Reclaim targets.
	const terrainMarkers = $derived(
		(location.terrain ?? []).filter(
			({ x, y, width, height }) =>
				x >= 0 && y >= 0 && x + width <= map.width && y + height <= map.height,
		),
	);
	// Workspace sheets can be missing from a partial export. Keep the
	// existing marker or icon until its world sheet has loaded.
	const loadedWorldSheets = new SvelteMap<string, boolean>();
	$effect(() => {
		const urls = new Set([
			...terrainMarkers.flatMap(
				({ frames }) => frames?.map(({ url }) => url) ?? [],
			),
			...markers.flatMap(({ object }) =>
				object.worldFrame ? [object.worldFrame.url] : [],
			),
		]);
		const listeners = new AbortController();
		for (const url of urls) {
			if (untrack(() => loadedWorldSheets.has(url))) continue;
			const image = new Image();
			image.addEventListener("load", () => loadedWorldSheets.set(url, true), {
				once: true,
				signal: listeners.signal,
			});
			image.addEventListener("error", () => loadedWorldSheets.set(url, false), {
				once: true,
				signal: listeners.signal,
			});
			image.src = url;
		}
		return () => listeners.abort();
	});

	const foliage = $derived(
		terrainMarkers
			.filter(
				({ frames }) =>
					frames?.some(({ url }) => loadedWorldSheets.get(url) === true) ===
					true,
			)
			.sort(
				(a, b) =>
					Number(a.kind !== "grass") - Number(b.kind !== "grass") || a.y - b.y,
			),
	);
	const foliageIds = $derived(new Set(foliage.map(({ id }) => id)));

	const selectedMarker = $derived(
		selection?.kind === "object"
			? markers.find(({ object }) => object.index === selection.objectIndex)
			: undefined,
	);
	// World sprites use 16 source pixels per tile and can overhang the
	// footprint. Keep both rectangles so roof hits never affect placement.
	const spriteScale = $derived(map.tileSize / 16);
	const buildings = $derived(
		(location.buildings ?? []).map((building) => {
			const sprite = readBuildingSprite(
				building.name,
				location.greenhouseRepaired,
			);
			const artWidth = (sprite?.width ?? 0) / 16;
			const artHeight = (sprite?.height ?? 0) / 16;
			return {
				...building,
				sprite,
				artWidth,
				artHeight,
				artX: building.x + (building.width - artWidth) / 2,
				artY: building.y + building.height - artHeight,
			};
		}),
	);
	// Sort by the front row of each saved footprint, including multi-tile
	// buildings and furniture. Sprite overhang does not change depth.
	const foreground = $derived(
		[
			...buildings.map((building) => ({
				kind: "building" as const,
				key: `building:${building.index}`,
				y: building.y + building.height - 1,
				building,
			})),
			...(location.furniture ?? []).map((item) => ({
				kind: "furniture" as const,
				key: `furniture:${item.index}`,
				y: item.y + item.height - 1,
				item,
			})),
			...foliage.flatMap((marker) =>
				(marker.frames ?? []).flatMap((frame, index) =>
					frame.tallSapling === true
						? [
								{
									kind: "sapling" as const,
									key: `${marker.id}:${index}`,
									marker,
									frame,
									y: marker.y,
								},
							]
						: [],
				),
			),
			...markers.map((marker) => ({
				...marker,
				kind: "object" as const,
				key: `object:${marker.object.index}`,
			})),
		].sort((a, b) => a.y - b.y),
	);

	const selectedBuilding = $derived(
		selection?.kind === "building"
			? buildings.find((building) => building.index === selection.buildingIndex)
			: undefined,
	);
	const selectedTile = $derived(
		selection?.kind === "tile"
			? selection.tile
			: (selectedBuilding ?? selectedMarker),
	);

	$effect(() => {
		background.getContext("2d")?.drawImage(map.canvas, 0, 0);
	});

	onMount(() => {
		fit();
		// Pointer events already handle map taps. Suppress the separate touch
		// click, which can hit a newly revealed toolbar button after a pick.
		return on(viewport, "touchend", (event) => event.preventDefault(), {
			passive: false,
		});
	});

	$effect(() => {
		// Selecting a distant object from the list reveals it at the current
		// zoom. Panning later must remain free to leave that selection offscreen.
		// Read the selection itself so choosing the same list row again can
		// reveal its tile after the user has panned away.
		if (!selection) return;
		untrack(() => {
			// Content edits republish marker rows while this viewport is hidden.
			// Only a fresh selection can reveal a tile, and only when visible.
			const tile = selectedTile;
			if (!tile || viewport.clientWidth === 0) return;
			const point = tileToViewport(camera, tile);
			const half = camera.pixelsPerTile / 2;
			const x = point.x + half;
			const y = point.y + half;
			if (
				x < 0 ||
				y < 0 ||
				x >= viewport.clientWidth ||
				y >= viewport.clientHeight
			)
				pan(viewport.clientWidth / 2 - x, viewport.clientHeight / 2 - y);
		});
	});

	/** Focus the map after an inspector action starts keyboard picking. */
	export function focusMap() {
		viewport.focus({ preventScroll: true });
	}

	function localPoint(event: PointerEvent): ViewportPoint {
		const rect = viewport.getBoundingClientRect();
		return { x: event.clientX - rect.left, y: event.clientY - rect.top };
	}

	function pointerTile(event: PointerEvent): MapTile | null {
		const point = localPoint(event);
		if (
			point.x < 0 ||
			point.y < 0 ||
			point.x >= viewport.clientWidth ||
			point.y >= viewport.clientHeight
		)
			return null;
		const tile = viewportToTile(camera, point);
		return tile.x >= 0 &&
			tile.y >= 0 &&
			tile.x < map.width &&
			tile.y < map.height
			? tile
			: null;
	}

	function startHandle(event: PointerEvent) {
		// Only the explicit handle claims an object drag. Swipes starting
		// over the map or its sprites continue to pan on touch screens.
		event.stopPropagation();
		if (event.button !== 0 || drag || pointers.size !== 0) return;
		if (event.currentTarget instanceof Element)
			event.currentTarget.setPointerCapture(event.pointerId);
		drag = {
			pointerId: event.pointerId,
			start: localPoint(event),
			started: false,
		};
	}

	function moveHandle(event: PointerEvent) {
		event.stopPropagation();
		if (drag?.pointerId !== event.pointerId) return;
		if (!drag.started) {
			const point = localPoint(event);
			if (Math.hypot(point.x - drag.start.x, point.y - drag.start.y) < 6)
				return;
			drag.started = true;
			beginMove();
		}
		pickDestination(pointerTile(event));
	}

	function endHandle(event: PointerEvent) {
		event.stopPropagation();
		if (drag?.pointerId !== event.pointerId) return;
		const started = drag.started;
		drag = undefined;
		if (!started) {
			if (event.type === "pointerup" && !placement) {
				beginMove();
				focusMap();
			}
			return;
		}
		// A cancelled pointer releases the draft without committing. A drop
		// submits the same candidate and validation path as Move here.
		if (event.type === "pointerup") dropDestination(pointerTile(event));
		else cancelMove();
	}

	function zoom(anchor: ViewportPoint, factor: number) {
		// Cap zoom so the viewport remains usable with both small and large maps.
		camera = zoomAt(
			camera,
			anchor,
			Math.min(
				64,
				Math.max(Math.min(3, fitScale()), camera.pixelsPerTile * factor),
			),
		);
	}

	function pan(dx: number, dy: number) {
		// Leave part of the map in view even after a long drag.
		const edge = 32;
		camera = {
			...camera,
			origin: {
				x: Math.max(
					edge - map.width * camera.pixelsPerTile,
					Math.min(viewport.clientWidth - edge, camera.origin.x + dx),
				),
				y: Math.max(
					edge - map.height * camera.pixelsPerTile,
					Math.min(viewport.clientHeight - edge, camera.origin.y + dy),
				),
			},
		};
	}

	function down(event: PointerEvent) {
		if (event.button !== 0 || pointers.size >= 2 || drag) return;
		const point = localPoint(event);
		// Any second pointer turns the gesture into navigation for its full lifetime.
		tapOrigin = pointers.size === 0 ? point : undefined;
		pointers.set(event.pointerId, point);
		viewport.focus({ preventScroll: true });
		viewport.setPointerCapture(event.pointerId);
	}

	function move(event: PointerEvent) {
		const previous = pointers.get(event.pointerId);
		if (!previous) return;
		const point = localPoint(event);
		pointers.set(event.pointerId, point);
		const other = [...pointers].find(([id]) => id !== event.pointerId)?.[1];
		if (other) {
			// Zoom about the old midpoint, then follow the moving midpoint.
			const distance = Math.hypot(previous.x - other.x, previous.y - other.y);
			if (distance > 0)
				zoom(
					{ x: (previous.x + other.x) / 2, y: (previous.y + other.y) / 2 },
					Math.hypot(point.x - other.x, point.y - other.y) / distance,
				);
			pan((point.x - previous.x) / 2, (point.y - previous.y) / 2);
			return;
		}
		// A little finger drift still counts as selection. Apply the whole
		// initial delta only when the gesture first crosses the pan threshold.
		if (
			tapOrigin &&
			Math.hypot(point.x - tapOrigin.x, point.y - tapOrigin.y) < 6
		)
			return;
		const start = tapOrigin ?? previous;
		tapOrigin = undefined;
		pan(point.x - start.x, point.y - start.y);
	}

	function end(event: PointerEvent) {
		if (!pointers.delete(event.pointerId)) return;
		const start = tapOrigin;
		tapOrigin = undefined;
		if (event.type !== "pointerup" || !start) return;
		const point = localPoint(event);
		if (Math.hypot(point.x - start.x, point.y - start.y) >= 6) return;
		const tile = pointerTile(event);
		if (!tile) return;
		if (pickingArea) {
			pickAreaTile(tile);
			return;
		}
		if (placement) {
			pickDestination(tile);
			return;
		}
		const matches = markers.filter(({ x, y }) => x === tile.x && y === tile.y);
		// Placed objects keep hit priority on their own tile. Furniture overlapping
		// a building opens the tile inspector so both records stay reachable.
		const furnitureHit =
			furnitureAtTile(location.furniture ?? [], tile).length > 0;
		// A lone building footprint otherwise selects the building.
		const buildingMatches = buildings.filter(
			(building) =>
				tile.x >= building.x &&
				tile.x < building.x + building.width &&
				tile.y >= building.y &&
				tile.y < building.y + building.height,
		);
		// Only check the art overhang when no object or footprint was hit.
		const roofMatches =
			matches.length === 0 && buildingMatches.length === 0
				? buildings.filter(
						(row) =>
							row.sprite !== undefined &&
							tile.x + 1 > row.artX &&
							tile.x < row.artX + row.artWidth &&
							tile.y + 1 > row.artY &&
							tile.y < row.y,
					)
				: [];
		const buildingsHit =
			buildingMatches.length > 0 ? buildingMatches : roofMatches;
		const building =
			matches.length === 0 && !furnitureHit && buildingsHit.length === 1
				? buildingsHit[0]
				: undefined;
		if (building) {
			select({
				kind: "building",
				locationId: location.id,
				buildingIndex: building.index,
				tile,
			});
			return;
		}
		// Ambiguous tiles stay selected as tiles. The inspector lists all matching records.
		const object = matches.length === 1 ? matches[0]?.object : undefined;
		select(
			object
				? { kind: "object", locationId: location.id, objectIndex: object.index }
				: { kind: "tile", locationId: location.id, tile },
		);
	}

	function fitScale() {
		// Use the same lower bound for zoom so a narrow viewport never jumps
		// above its fitted scale when the user tries to zoom out.
		return Math.min(
			viewport.clientWidth / map.width,
			viewport.clientHeight / map.height,
		);
	}

	function fit() {
		// Center the complete map after a reset, including on narrow phones.
		const pixelsPerTile = fitScale();
		camera = {
			pixelsPerTile,
			origin: {
				x: (viewport.clientWidth - map.width * pixelsPerTile) / 2,
				y: (viewport.clientHeight - map.height * pixelsPerTile) / 2,
			},
		};
	}

	function zoomFromCenter(factor: number) {
		zoom({ x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 }, factor);
		pan(0, 0);
	}
	function areaStartTile() {
		const center = viewportToTile(camera, {
			x: viewport.clientWidth / 2,
			y: viewport.clientHeight / 2,
		});
		return {
			x: Math.min(map.width - 1, Math.max(0, center.x)),
			y: Math.min(map.height - 1, Math.max(0, center.y)),
		};
	}

	function keydown(event: KeyboardEvent) {
		if (placement && event.key === "Escape") {
			event.preventDefault();
			cancelMove();
			return;
		}
		if (pickingArea && event.key === "Enter") {
			event.preventDefault();
			const cursor = areaCursor ?? areaStartTile();
			pickAreaTile(cursor);
			return;
		}
		// Keep map navigation available without pointer gestures. The object
		// list is the keyboard and screen-reader entry point for object selection.
		const step = 48;
		const deltas: Record<string, ViewportPoint> = {
			ArrowLeft: { x: step, y: 0 },
			ArrowRight: { x: -step, y: 0 },
			ArrowUp: { x: 0, y: step },
			ArrowDown: { x: 0, y: -step },
		};
		const delta = deltas[event.key];
		if (!delta || !Object.hasOwn(deltas, event.key)) return;
		event.preventDefault();
		if (pickingArea && !event.shiftKey) {
			// Keyboard corners go through the same picker as taps. Reveal the
			// cursor if it crosses the visible edge; Shift+Arrow only pans.
			const current = areaCursor ?? areaStartTile();
			const tile = {
				x: Math.min(map.width - 1, Math.max(0, current.x - Math.sign(delta.x))),
				y: Math.min(
					map.height - 1,
					Math.max(0, current.y - Math.sign(delta.y)),
				),
			};
			areaCursor = tile;
			const point = tileToViewport(camera, tile);
			if (
				point.x < 0 ||
				point.y < 0 ||
				point.x + camera.pixelsPerTile > viewport.clientWidth ||
				point.y + camera.pixelsPerTile > viewport.clientHeight
			)
				pan(
					viewport.clientWidth / 2 - point.x,
					viewport.clientHeight / 2 - point.y,
				);
			return;
		}
		if (placement && !event.shiftKey) {
			// Arrow keys pick in one-tile increments during placement. Holding
			// Shift retains the map's ordinary camera navigation.
			const source = placement.candidate ?? selectedTile;
			if (!source) return;
			const tile = {
				x: source.x - Math.sign(delta.x),
				y: source.y - Math.sign(delta.y),
			};
			if (
				tile.x >= 0 &&
				tile.y >= 0 &&
				tile.x < map.width &&
				tile.y < map.height
			)
				pickDestination(tile);
			return;
		}
		pan(delta.x, delta.y);
	}
</script>

{#snippet worldArt(
	x: number,
	y: number,
	frame: WorldFrame,
	kind: string,
	name: string,
)}
	<div
		class="world-art"
		class:flipped={frame.flipped === true}
		data-world-art={kind}
		data-world-name={name}
		style:left={`${(x + frame.offsetX) * map.tileSize}px`}
		style:top={`${(y + frame.offsetY) * map.tileSize}px`}
		style:width={`${frame.width}px`}
		style:height={`${frame.height}px`}
		style:--sprite={`url("${frame.url}")`}
		style:--sprite-position={`${-frame.sourceX}px ${-frame.sourceY}px`}
		style:--sprite-scale={spriteScale}
	></div>
{/snippet}

<!-- The map owns custom pointer and arrow-key navigation. Named object
     controls remain available in the inspector outside the application region. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
	class="viewport"
	role="application"
	aria-label="Farm map"
	tabindex="0"
	onkeydown={keydown}
	bind:this={viewport}
	onpointerdown={down}
	onpointermove={move}
	onpointerup={end}
	onpointercancel={end}
	onlostpointercapture={end}
>
	<div
		class="world"
		style:--tile-size={`${map.tileSize}px`}
		style:--floor-image="url(/content/TerrainFeatures/Flooring.png)"
		style:--soil-image="url(/content/TerrainFeatures/hoeDirt.png)"
		aria-hidden="true"
		style:transform={`translate(${camera.origin.x}px, ${camera.origin.y}px) scale(${scale})`}
	>
		<canvas
			bind:this={background}
			width={map.canvas.width}
			height={map.canvas.height}
		></canvas>

		{#each terrainMarkers.filter(({ id }) => !foliageIds.has(id)) as marker (marker.id)}
			{@const swatch =
				marker.material === undefined
					? undefined
					: floorSwatches?.get(marker.material)}
			<div
				class="terrain-marker"
				data-terrain={marker.kind}
				class:planted={marker.planted === true}
				class:hidden-soil={marker.hiddenSoil === true}
				class:swatch={swatch !== undefined}
				style:--floor-position={swatch
					? `${-swatch.x}px ${-swatch.y}px`
					: undefined}
				style:left={`${marker.x * map.tileSize}px`}
				style:top={`${marker.y * map.tileSize}px`}
				style:width={`${marker.width * map.tileSize}px`}
				style:height={`${marker.height * map.tileSize}px`}
			></div>
		{/each}

		<!-- Keep trunks and low foliage opaque below the placed objects. -->
		{#each foliage as marker (marker.id)}
			{#each marker.frames ?? [] as frame, index (index)}
				{#if !frame.canopy && !frame.tallSapling}
					{@render worldArt(
						marker.x,
						marker.y,
						frame,
						marker.kind,
						marker.label,
					)}
				{/if}
			{/each}
		{/each}

		<div class="grid"></div>

		{#if area}
			<div
				class="area-outline"
				style:left={`${area.left * map.tileSize}px`}
				style:top={`${area.top * map.tileSize}px`}
				style:width={`${(area.right - area.left + 1) * map.tileSize}px`}
				style:height={`${(area.bottom - area.top + 1) * map.tileSize}px`}
			></div>
		{/if}
		{#each removalTargets as target (`${target.collection}:${target.index}`)}
			<div
				class="removal-target"
				style:left={`${target.area.left * map.tileSize}px`}
				style:top={`${target.area.top * map.tileSize}px`}
				style:width={`${(target.area.right - target.area.left + 1) * map.tileSize}px`}
				style:height={`${(target.area.bottom - target.area.top + 1) * map.tileSize}px`}
			></div>
		{/each}

		{#each foreground as entry (entry.key)}
			{#if entry.kind === "building"}
				{@const { building } = entry}
				<div
					class="building-footprint"
					style:left={`${building.x * map.tileSize}px`}
					style:top={`${building.y * map.tileSize}px`}
					style:width={`${building.width * map.tileSize}px`}
					style:height={`${building.height * map.tileSize}px`}
				>
					<span class="footprint-label">{building.name}</span>
				</div>

				{#if building.sprite}
					{@const sprite = building.sprite}
					{@render worldArt(
						building.x,
						building.y,
						{
							url: sprite.url,
							sourceX: sprite.x,
							sourceY: sprite.y,
							width: sprite.width,
							height: sprite.height,
							offsetX: building.artX - building.x,
							offsetY: building.artY - building.y,
						},
						"building",
						building.name,
					)}
				{/if}
			{:else if entry.kind === "furniture"}
				{@const { item } = entry}
				{#if item.sprite}
					{@const sprite = item.sprite}
					{@render worldArt(
						item.x,
						item.y,
						{
							...sprite,
							url: furnitureSheet,
							offsetX: sprite.x - item.x,
							offsetY: sprite.y - item.y,
						},
						"furniture",
						item.name,
					)}
				{:else}
					<div
						class="furniture-footprint"
						data-furniture={item.name}
						style:left={`${item.x * map.tileSize}px`}
						style:top={`${item.y * map.tileSize}px`}
						style:width={`${item.width * map.tileSize}px`}
						style:height={`${item.height * map.tileSize}px`}
					>
						<span class="footprint-label">{item.name}</span>
					</div>
				{/if}
			{:else if entry.kind === "sapling"}
				{@render worldArt(
					entry.marker.x,
					entry.y,
					entry.frame,
					entry.marker.kind,
					entry.marker.label,
				)}
			{:else}
				{@const { object, x, y, frame } = entry}
				{#if frame && (!object.worldFrame || loadedWorldSheets.get(frame.url))}
					{@render worldArt(x, y, frame, "object", object.name)}
				{:else}
					<div
						class="marker"
						style:left={`${x * map.tileSize}px`}
						style:top={`${y * map.tileSize}px`}
					>
						{#if object.visual}
							<BackpackItemVisual
								visual={object.visual}
								size={map.tileSize}
							/>
						{:else}
							<!-- Keep unsprited records pickable without hiding the map under icons. -->
							<span class="unknown-marker"></span>
						{/if}
					</div>
				{/if}
			{/if}
		{/each}

		<!-- Composite crowns together before applying opacity so overlapping
		     trees cannot build up opacity. Selection and edit overlays stay above. -->
		<div class="canopy-layer">
			{#each foliage as marker (marker.id)}
				{#each marker.frames ?? [] as frame, index (index)}
					{#if frame.canopy}
						{@render worldArt(
							marker.x,
							marker.y,
							frame,
							marker.kind,
							marker.label,
						)}
					{/if}
				{/each}
			{/each}
		</div>

		<!-- Mark the matching tiles above scenery so previews stay readable
		     wherever a placed object or canopy overlaps a path. -->
		{#each flooringTargets as tile (`${tile.x},${tile.y}`)}
			<div
				class="flooring-target"
				class:replace={tile.previous !== undefined}
				style:left={`${tile.x * map.tileSize}px`}
				style:top={`${tile.y * map.tileSize}px`}
			></div>
		{/each}

		{#if placement?.candidate}
			<div
				class="candidate"
				class:blocked={placementProblem !== undefined}
				style:left={`${placement.candidate.x * map.tileSize}px`}
				style:top={`${placement.candidate.y * map.tileSize}px`}
				style:width={selectedBuilding
					? `${selectedBuilding.width * map.tileSize}px`
					: undefined}
				style:height={selectedBuilding
					? `${selectedBuilding.height * map.tileSize}px`
					: undefined}
			>
				{#if !selectedBuilding}<BackpackItemVisual
						visual={selectedMarker?.object.visual}
						size={map.tileSize}
					/>{/if}
			</div>
			{#each selectedBuilding?.doors ?? [] as door (`${door.x},${door.y}`)}
				<div
					class="candidate door-approach"
					class:blocked={placementProblem !== undefined}
					style:left={`${(placement.candidate.x + door.x) * map.tileSize}px`}
					style:top={`${(placement.candidate.y + door.y) * map.tileSize}px`}
				></div>
			{/each}
		{/if}

		{#if pickingArea && areaCursor}
			<div
				class="selected"
				style:left={`${areaCursor.x * map.tileSize}px`}
				style:top={`${areaCursor.y * map.tileSize}px`}
			></div>
		{/if}

		{#if selectedTile}
			<div
				class="selected"
				style:left={`${selectedTile.x * map.tileSize}px`}
				style:top={`${selectedTile.y * map.tileSize}px`}
				style:width={selectedBuilding
					? `${selectedBuilding.width * map.tileSize}px`
					: undefined}
				style:height={selectedBuilding
					? `${selectedBuilding.height * map.tileSize}px`
					: undefined}
			></div>
			{#each selectedBuilding?.doors ?? [] as door (`${door.x},${door.y}`)}
				<div
					class="selected door-approach"
					style:left={`${(selectedTile.x + door.x) * map.tileSize}px`}
					style:top={`${(selectedTile.y + door.y) * map.tileSize}px`}
				></div>
			{/each}
		{/if}
	</div>
	{#if areaPrompt}
		<div
			class="placement-status"
			role="status"
		>
			{areaPrompt}
		</div>
	{/if}

	{#if placement}
		<!-- Keep feedback in the viewport while a finger covers the candidate.
		     The status never captures a gesture or changes the map's dimensions. -->
		<div
			class="placement-status"
			role="status"
		>
			<strong>
				Move {selectedBuilding?.name ?? selectedMarker?.object.name ?? "chest"}
			</strong>
			{#if placement.candidate}
				<span>Tile {placement.candidate.x}, {placement.candidate.y}</span>
				{#if placementProblem}<span>
						{placementProblem} Choose another tile.
					</span>{/if}
			{:else if dropOutside}
				<span>Drop landed outside the farm. Choose a tile on the map.</span>
			{:else}
				<span>Choose a destination tile.</span>
			{/if}
		</div>
	{/if}

	{#if movable && selectedTile && !selectedBuilding}
		{@const anchor = tileToViewport(camera, selectedTile)}
		<button
			class="study-kit study-button move-handle"
			type="button"
			aria-label="Drag chest"
			style:left={`${anchor.x + camera.pixelsPerTile / 2}px`}
			style:top={`${anchor.y + camera.pixelsPerTile}px`}
			hidden={placement !== null && !drag?.started}
			onpointerdown={startHandle}
			onpointermove={moveHandle}
			onpointerup={endHandle}
			onpointercancel={endHandle}
			onlostpointercapture={endHandle}
			onclick={(event) => {
				if (event.detail === 0 && !placement) {
					beginMove();
					focusMap();
				}
			}}
		>
			Move
		</button>
	{/if}
</div>

<div
	class="controls"
	aria-label="Map zoom controls"
	role="group"
>
	<button
		class="study-kit study-button"
		type="button"
		onclick={() => zoomFromCenter(0.8)}
	>
		Zoom out
	</button>
	<button
		class="study-kit study-button"
		type="button"
		onclick={fit}
	>
		Fit map
	</button>
	<button
		class="study-kit study-button"
		type="button"
		onclick={() => zoomFromCenter(1.25)}
	>
		Zoom in
	</button>
</div>

<style>
	.viewport {
		position: relative;
		overflow: hidden;
		height: clamp(240px, 48dvh, 540px);
		background: #30271e;
		touch-action: none;
		cursor: grab;
	}

	.viewport:active {
		cursor: grabbing;
	}

	.world {
		position: absolute;
		transform-origin: top left;
		pointer-events: none;
	}

	canvas {
		display: block;
		max-width: none;
		image-rendering: pixelated;
	}

	.grid {
		position: absolute;
		inset: 0;
		background-image:
			linear-gradient(to right, #211b183d 1px, transparent 1px),
			linear-gradient(to bottom, #211b183d 1px, transparent 1px);
		background-size: var(--tile-size) var(--tile-size);
	}

	.marker,
	.candidate,
	.selected {
		position: absolute;
		width: var(--tile-size);
		height: var(--tile-size);
	}

	.unknown-marker {
		position: absolute;
		inset: 25%;
		background: #fff2a9;
		border: 1px solid #30271e;
		border-radius: 50%;
		box-sizing: border-box;
	}

	.selected {
		box-sizing: border-box;
		border: 2px solid #fff2a9;
		box-shadow: 0 0 0 1px #30271e;
	}

	/* Use different silhouettes for saved terrain so the preview tint can
	   remain a separate overlay with a single meaning. */
	.terrain-marker {
		position: absolute;
		--marker-shape: 18%;
		--marker-fill: #877461;
	}

	.terrain-marker::after {
		content: "";
		position: absolute;
		inset: 12%;
		border: 1px solid #33271c;
		border-radius: var(--marker-shape);
		background: var(--marker-fill);
	}

	.terrain-marker[data-terrain="grass"] {
		--marker-shape: 70% 18%;
		--marker-fill: #8bbf4a;
	}

	.terrain-marker[data-terrain="tree"],
	.terrain-marker[data-terrain="bush"] {
		--marker-shape: 50%;
		--marker-fill: #39783d;
	}

	.terrain-marker[data-terrain="fruit-tree"],
	.terrain-marker[data-terrain="giant-crop"] {
		--marker-shape: 50%;
		--marker-fill: #74629f;
	}

	.terrain-marker[data-terrain="flooring"],
	.terrain-marker[data-terrain="soil"]:not(.hidden-soil) {
		image-rendering: pixelated;
	}

	/* Keep a visible fallback for missing swatches, and let mapped paths
	   blend with the ground through transparent pixels in the atlas. */
	.terrain-marker[data-terrain="flooring"]:not(.swatch) {
		background-color: #a7967d;
	}

	.terrain-marker[data-terrain="flooring"].swatch {
		background: var(--floor-image) no-repeat var(--floor-position);
	}

	.terrain-marker[data-terrain="soil"]:not(.hidden-soil) {
		background: #9b5d2f var(--soil-image) no-repeat;
	}

	.terrain-marker[data-terrain="flooring"]::after,
	.terrain-marker[data-terrain="soil"]::after {
		content: none;
	}

	.terrain-marker.planted::after {
		content: "";
		inset: 22% 30%;
		border-radius: 8% 68%;
		background: #71b942;
	}

	.area-outline,
	.removal-target {
		position: absolute;
		box-sizing: border-box;
		border: 1px solid;
	}

	.area-outline {
		border-color: #97d8ff;
		background: #3799c52e;
	}

	.removal-target {
		z-index: 1;
		border-color: #ffb9a5;
		background: #972d2370;
	}

	.building-footprint {
		position: absolute;
		box-sizing: border-box;
		border: 1px dashed #664621;
		background: #a87d4444;
	}

	.flooring-target {
		position: absolute;
		z-index: 1;
		width: var(--tile-size);
		height: var(--tile-size);
		box-sizing: border-box;
		border: 1px solid #b0fcff;
		background: #35bdc266;
		pointer-events: none;
	}

	.flooring-target.replace {
		border-color: #f1c6ff;
		background: #ba67d288;
	}

	.canopy-layer {
		position: absolute;
		inset: 0;
		opacity: 0.38;
		pointer-events: none;
	}

	.world-art {
		position: absolute;
		background-image: var(--sprite);
		background-position: var(--sprite-position);
		background-repeat: no-repeat;
		image-rendering: pixelated;
		transform: scale(var(--sprite-scale));
		transform-origin: top left;
	}

	.world-art.flipped {
		transform: translateX(calc(100% * var(--sprite-scale)))
			scale(calc(-1 * var(--sprite-scale)), var(--sprite-scale));
	}

	.furniture-footprint {
		position: absolute;
		box-sizing: border-box;
		border: 1px solid #fff1bd;
		background: #68456cbf;
	}

	.footprint-label {
		display: block;
		overflow: hidden;
		color: #fff7df;
		background: #33241ad9;
		font: 8px/1.4 sans-serif;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.door-approach {
		border-style: dashed;
	}

	.candidate {
		box-sizing: border-box;
		border: 2px solid #e7ffc2;
		background: #44752c88;
	}

	.candidate.blocked {
		border-color: #ffb9a5;
		background: #972d2388;
	}

	.placement-status {
		position: absolute;
		inset: 8px 8px auto;
		width: fit-content;
		max-width: calc(100% - 16px);
		box-sizing: border-box;
		padding: 6px 8px;
		border: 1px solid #ba8c52;
		background: #fff0ce;
		color: #311304;
		pointer-events: none;
	}

	.placement-status span {
		display: block;
	}

	.move-handle {
		position: absolute;
		width: 44px;
		padding-inline: 0;
		transform: translateX(-50%);
		touch-action: none;
		cursor: grab;
	}

	.move-handle[hidden] {
		display: none;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-block: 6px;
	}

	button {
		min-height: 44px;
	}
</style>
