<script lang="ts">
	import { untrack, tick } from "svelte";
	import type { EditorModel } from "../editor-model.ts";
	import ConfirmAction from "./ConfirmAction.svelte";
	let { model }: { model: EditorModel } = $props();
	const { view, pending } = untrack(() => model);
	let revision: number | undefined;
	let result = $state<HTMLParagraphElement>();
</script>

<h1>Bundles</h1>
<section class="study-pane">
	<h2>Spring Foraging</h2>
	<p>
		This prototype supports one vanilla bundle: Wild Horseradish, Daffodil,
		Leek, and Dandelion.
	</p>
	{#if !$view?.bundle.supported}
		<p role="status">{$view?.bundle.reason}</p>
	{:else if $view.bundle.completed}
		<p role="status" tabindex="-1" bind:this={result}>
			Complete. {$view.bundle.rewardAvailable
				? "30 Spring Seeds are available to collect in game."
				: "The reward has already been collected."}
		</p>
	{:else}
		<p>
			Mark all four donations complete and make 30 Spring Seeds available in
			game. Items stay in your inventory. If this finishes the room, its repair
			and completion flags are included.
		</p>
		<ConfirmAction
			title="Complete Spring Foraging?"
			description="All four donations and the pending reward will change together. Any resulting room flags are included. You can undo this action."
			label="Complete bundle"
			oncomplete={() => {
				void tick().then(() => result?.focus());
			}}
			disabled={$pending > 0}
			prepare={() => {
				revision = $view?.revision;
			}}
			commit={() =>
				model.execute([{ type: "bundle-complete", bundleId: 13 }], revision)}
		/>
	{/if}
</section>

<style>
	section {
		padding: 20px;
		max-width: 680px;
	}
	p {
		line-height: 1.4;
	}
</style>
