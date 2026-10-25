<script lang="ts">
	import { onMount } from "svelte";
	import { makeAtomInventory } from "../inventory-atoms.ts";
	import { openInventory } from "../inventory-model.ts";
	import { makeStoreInventory } from "../inventory-stores.ts";
	import Panel from "./Panel.svelte";

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
	{#if error}<p role="alert">{error}</p>{/if}
	{#if active}
		{#key active}<Panel model={active.model} />{/key}
	{:else}<p role="status">Opening session…</p>{/if}
</main>

<style>
	main {
		max-width: 760px;
		margin: 32px auto;
		padding: 0 20px;
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
