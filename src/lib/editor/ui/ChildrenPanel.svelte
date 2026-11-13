<script lang="ts">
	import { useAtomValue } from "effect-atom-svelte";
	import type { EditorModel } from "../editor-model.ts";
	import ChildCard from "./ChildCard.svelte";
	import StudyAlert from "../../ui/kit/StudyAlert.svelte";
	let { model }: { model: EditorModel } = $props();
	const view = useAtomValue(() => model.atomBindings.view);
</script>

<!-- Children are shared world residents. Show their saved parent and home
     explicitly instead of making farmer selection imply exclusive ownership. -->
<div class="children">
	<header>
		<div>
			<p class="eyebrow">Family on the farm</p>

			<h2>Children</h2>

			<p class="intro">The little ones, across all your farm's homes.</p>
		</div>

		<p class="total">
			{view.current?.children.length ?? 0} saved {(view.current?.children
				.length ?? 0) === 1
				? "child"
				: "children"}
		</p>
	</header>

	<div class="child-list">
		{#each view.current?.children ?? [] as child (child.key)}
			<ChildCard {child} {model} />
		{:else}
			<StudyAlert title="No children in this save">
				<p>
					Existing children will appear here with their saved parent and home.
					Children can be renamed here once they are part of your farm.
				</p>
			</StudyAlert>
		{/each}
	</div>

	{#if view.current?.children.length}
		<p class="note">
			Apply a child's changes together, then review or Undo them. Renaming keeps
			friendship and daily interactions for every farmer.
		</p>
	{/if}
</div>

<style>
	header {
		display: flex;
		justify-content: space-between;
		align-items: end;
		flex-wrap: wrap;
		gap: 16px;
		margin: 4px 0 24px;
	}
	.eyebrow {
		margin: 0 0 4px;
		font-size: 15px;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--study-muted, #694621);
	}
	h2 {
		font-size: 30px;
		margin: 0;
	}
	.intro,
	.total,
	.note {
		color: var(--study-muted, #694621);
	}
	.intro {
		margin: 6px 0 0;
	}
	.total {
		margin: 0;
		padding-bottom: 3px;
	}
	.child-list {
		display: grid;
		gap: 18px;
	}
	.note {
		font-size: 17px;
		margin: 20px 0 0;
		line-height: 1.4;
	}
</style>
