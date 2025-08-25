<script lang="ts">
	import { CCRoom, bundleSideEffects } from "$lib/bundleSideEffects";
	import type { CommunityBundles } from "$lib/proxies/CommunityBundles.svelte";
	import type { SaveProxy } from "$lib/proxies/SaveFile.svelte";

	let projects = [
		{ room: CCRoom.Vault, name: "Bus", price: 40000 },
		{
			room: CCRoom.BoilerRoom,
			name: "Minecarts",
			price: 15000,
		},
		{
			room: CCRoom.CraftsRoom,
			name: "Bridge",
			price: 25000,
		},
		{
			room: CCRoom.Pantry,
			name: "Greenhouse",
			price: 35000,
		},
		{
			room: CCRoom.FishTank,
			name: "Panning",
			price: 20000,
		},
	] satisfies {
		room: CCRoom;
		name: string;
		price: number;
	}[];

	interface Props {
		bundles: CommunityBundles;
		save: SaveProxy;
	}

	let { bundles, save }: Props = $props();

	// Complete the bundle for each room
	// This probably is a fairly intuitive way to do it; enabling/disabling the membership won't affect the completed bundles
	function setProject(room: CCRoom, checked: boolean) {
		for (const bundle of bundles.bundles.filter((b) => b.room === room)) {
			for (const item of bundle.requiredItems) {
				item.submitted = checked;
			}
		}

		// As an edge case, if all bundles are completed when changing from Joja to Community Center,
		// Complete the "missing" bundle, as the user would have otherwise had access to the movie theater
		// I basically just copied and pasted this from CommunityBundles.svelte (todo refactor)
		const bundlesByRoom = Map.groupBy(bundles.bundles, (b) => b.room);
		const completedRooms = [...bundlesByRoom.entries()].map(
			([room, bundles]) => [room, bundles.every((b) => b.completed)] as const,
		);
		if (
			completedRooms
				.filter(
					([r]) =>
						![CCRoom.AbandonedJojaMart, CCRoom.BulletinBoard].includes(r),
				)
				.every(([, completed]) => completed)
		) {
			const abandonedBundle = bundlesByRoom.get(CCRoom.AbandonedJojaMart);
			for (const bundle of abandonedBundle ?? []) {
				for (const item of bundle.requiredItems) {
					item.submitted = checked;
				}
			}
		}

		// Lastly, apply the side effects of the bundles
		bundles.applySideEffects(save);
	}

	function getProject(room: CCRoom) {
		return bundles.bundles.some((b) => b.room === room && b.completed);
	}
</script>

<div class="joja-page">
	<header>
		<div class="logo">Joja *</div>
		<div>
			<h1>Community Development Projects</h1>
			<div class="town">Pelican Town</div>
		</div>
	</header>

	<section class="projects-grid" data-testid="joja-projects">
		{#each projects as p}
			<label
				class="project-row"
				data-testid="joja-project-row"
				data-project-name={p.name}
			>
				<input
					type="checkbox"
					checked={getProject(p.room)}
					data-testid="joja-project-checkbox"
					onchange={(e) => {
						// @ts-ignore
						setProject(p.room, e.target.checked);
					}}
				/>
				<span class="project-name">{p.name}</span>
				<span class="dots"></span>
				<span class="price">{p.price} g</span>
			</label>
		{/each}
		<div class="project-row last">
			Prepared by:
			<span class="signature">Morris</span>
		</div>
	</section>
</div>

<style>
	.joja-page {
		font-family: monospace;
		color: #89b7fc;
		background: #ffffff;
		max-width: 480px;
		margin: auto;
		border: 2px solid #5d5c9b;
		/* box-shadow: inset 0 0 0 4px #2e3042; */
		image-rendering: pixelated;
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-evenly;
		margin: 1rem;
	}

	.logo {
		font-size: 2rem;
		color: #89b7fc;
	}

	h1 {
		font-size: 0.9rem;
		text-align: center;
		flex: 1;
	}

	.town {
		font-size: 0.75rem;
		border-bottom: 2px solid #89b7fc;
		color: #b0b8c3;
		text-align: center;
		max-width: 150px;
		margin: 0 auto;
	}

	.projects-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		color: #5d5c9b;
		margin-right: -2px;
		border-top: 2px solid #5d5c9b;
	}

	.project-row {
		display: flex;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		background: #ffffff;
		border-right: 2px solid #5d5c9b;
		border-bottom: 2px solid #89b7fc;
		padding: 4px;
	}

	.project-row input {
		width: 1em;
		height: 1em;
	}

	.project-name {
		white-space: nowrap;
	}

	.dots {
		border-bottom: 2px dotted #5d5c9b;
		margin: 0 0.5rem;
		height: 1em;
		flex: 1;
	}

	.price {
		white-space: nowrap;
	}

	.last {
		color: #89b7fc;
	}

	.signature::before {
		content: "x";
		color: #89b7fc;
		font-family: initial;
		margin-right: 4px;
		font-size: 0.7em;
	}

	.signature {
		color: #5d5c9b;
		font-size: 1.5em;
		margin-left: 4px;
		font-family: "Brush Script MT", cursive;
		border-bottom: 2px solid #89b7fc;
		line-height: 0.8em;
		flex: 1;
	}
</style>
