<script lang="ts">
	import { onMount } from "svelte";
	import { makeAtomInventory } from "../inventory-atoms.ts";
	import { openInventory } from "../inventory-model.ts";
	import { makeStoreInventory } from "../inventory-stores.ts";
	import Panel from "./Panel.svelte";
	import PixelFrame from "../../../src/lib/ui/PixelFrame.svelte";
	import UiIcon from "../../../src/lib/ui/UIIcon.svelte";
	import {
		setUiAssets,
		resolveUiAssets,
		uiIcons,
		type UiIconName,
	} from "../../../src/lib/ui/uiAssets";
	import menuUrl from "../../../static/assets/MenuTiles.png?url";
	import cursorsUrl from "../../../static/assets/Cursors.png?url";
	import objectsUrl from "../../../static/assets/springobjects.png?url";
	import craftablesUrl from "../../../static/assets/Craftables.png?url";
	import barnUrl from "../../../static/assets/buildings/Barn.png?url";
	import shirtsUrl from "../../../static/assets/shirts.png?url";

	const atlasUrls = {
		menu: menuUrl,
		cursors: cursorsUrl,
		objects: objectsUrl,
		craftables: craftablesUrl,
		barn: barnUrl,
		shirts: shirtsUrl,
	};
	setUiAssets(resolveUiAssets((name) => atlasUrls[name]));
	let gameSkin = $state(
		new URL(location.href).searchParams.get("skin") === "game",
	);
	const iconNames = Object.keys(uiIcons) as UiIconName[];

	let kind = $state("atom");
	let active = $state.raw<Awaited<ReturnType<typeof openInventory>>>();
	let error = $state("");
	let generation = 0;
	async function open() {
		const current = ++generation;
		const previous = active;
		active = undefined;
		await previous?.close();
		try {
			const opened = await openInventory(
				kind === "atom" ? makeAtomInventory : makeStoreInventory,
			);
			if (current !== generation) {
				await opened.close();
				return;
			}
			active = opened;
		} catch (cause) {
			if (current === generation) error = String(cause);
		}
	}
	onMount(() => {
		void open();
		return () => {
			generation++;
			void active?.close();
		};
	});
</script>

<main>
	<h1>Inventory state experiment</h1>
	<p>
		The same inventory flow, backed by either Effect Atom or Svelte stores.
		Switching implementations starts a fresh session.
	</p>
	<label for="implementation">Implementation</label>
	<select id="implementation" bind:value={kind} onchange={() => void open()}>
		<option value="atom">Effect Atom</option><option value="store"
			>Svelte stores</option
		>
	</select>
	<label for="visual-shell">Visual shell</label>
	<select id="visual-shell" bind:value={gameSkin}>
		<option value={false}>Plain comparison</option><option value={true}
			>Game frame and icons</option
		>
	</select>
	{#if error}<p role="alert">{error}</p>{/if}
	<div data-ui-theme class={{ game: gameSkin }}>
		<PixelFrame enabled={gameSkin}>
			{#if gameSkin}
				<h2>Game asset study</h2>
				<p>
					The game's menu frame and tab sprites around the same transactional
					editor.
				</p>
				<div class="icon-study">
					{#each iconNames as name (name)}<figure>
							<UiIcon {name} />
							<figcaption>{name}</figcaption>
						</figure>{/each}
				</div>
			{/if}
			{#if active}
				{#key active}<Panel model={active.model} />{/key}
			{:else}<p role="status">Opening session…</p>{/if}
		</PixelFrame>
	</div>
</main>

<style>
	main {
		max-width: 960px;
		margin: 32px auto;
		padding: 0 20px;
	}
	.game {
		margin-top: 24px;
		--editor-surface: #fff1d0;
		--editor-control: #f8d390;
		--editor-selected: #eebc70;
		--editor-border: #91502c;
		--editor-focus: #663318;
	}
	.game :global(section[aria-label="Inventory editor"]) {
		border: none;
		border-radius: 0;
		background: transparent;
		padding: 0;
	}
	.game :global(input),
	.game :global(select) {
		background: #fff2d4;
	}
	.icon-study {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		border-block: 2px solid #b8793f;
		padding-block: 16px;
	}
	figure {
		display: grid;
		justify-items: center;
		gap: 6px;
		margin: 0;
	}
	figcaption {
		font-size: 0.8rem;
	}
	h2 {
		margin-top: 0;
	}
	@media (max-width: 480px) {
		main {
			padding-inline: 8px;
		}
		.icon-study {
			gap: 12px;
		}
	}
	h1 {
		font-size: 1.8rem;
	}
	label {
		display: block;
		margin-top: 20px;
	}
	select {
		padding: 8px;
		font: inherit;
		max-width: 100%;
	}
</style>
