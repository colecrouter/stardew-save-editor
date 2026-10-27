<script lang="ts">
	import { useAtomValue } from "effect-atom-svelte";
	import { untrack } from "svelte";
	import type { EditorModel } from "../editor-model.ts";
	let { model }: { model: EditorModel } = $props();
	const { atomBindings } = untrack(() => model);
	// Hooks subscribe through the nearest file provider. Keep the accessor object:
	// destructuring .current would capture a stale non-reactive value.
	const view = useAtomValue(atomBindings.view);
	const pending = useAtomValue(atomBindings.pending);
	let error = $state("");
	async function reverse() {
		// Capture one committed projection for the entire permutation. A reactive
		// accessor can change later; the operation itself still validates the target.
		const snapshot = view.current;
		if (!snapshot) return;
		error = "";
		try {
			await model.execute([
				{
					type: "reorder",
					farmerId: snapshot.farmerId,
					order: Array.from(
						{ length: snapshot.backpackSize },
						(_, i) => snapshot.backpackSize - i - 1,
					),
				},
			]);
		} catch (cause) {
			error = String(cause);
		}
	}
</script>

{#if view.current}
	<h1>Review changes</h1>
	<p>
		History records what you did. Net changes compare the current save with the
		imported file.
	</p>
	{#if view.current.dropped}
		<p role="status">
			{view.current.dropped} older undo entries were removed to stay within the history
			limit. Net changes still include them.
		</p>
	{/if}
	<h2>Edit history</h2>
	<ol>
		{#each view.current.entries.filter((entry) => !entry.compact) as entry (entry.id)}
			<li class={{ undone: !entry.applied }}>
				<strong>{entry.label}</strong>
				{#if !entry.applied}
					(undone){/if}
				{#if entry.annotations.length}
					<!-- Show the successful domain substeps separately from actual
                         patches. Metadata explains intent; patches verify it. -->
					<details>
						<summary>
							Operations in this change ({entry.annotations.length})
						</summary>
						<ul>
							{#each entry.annotations as annotation, index (index)}
								<li>
									{annotation.label || "Unlabelled changes"}
									{#if annotation.tags?.length}
										<small>Tags: {annotation.tags.join(", ")}</small>
									{/if}
								</li>
							{/each}
						</ul>
					</details>
				{/if}
				<details>
					<summary>Affected save fields ({entry.paths.length})</summary>
					<ul>
						{#each entry.paths as path, index (`${index}
:${path}`)}
							<li>
								<code>{path}</code>
							</li>
						{/each}
					</ul>
				</details>
			</li>
		{/each}
	</ol>
	<details>
		<summary>
			Compact inventory operations ({view.current.entries.filter(
				(entry) => entry.compact,
			).length})
		</summary>
		<ul>
			{#each view.current.entries.filter((entry) => entry.compact) as entry (entry.id)}
				<li class={{ undone: !entry.applied }}>
					{entry.label}{#if !entry.applied}
						(undone){/if}
					<details>
						<summary>Affected fields</summary>
						<ul>
							{#each entry.paths as path, index (`${index}
:${path}`)}
								<li>
									<code>{path}</code>
								</li>
							{/each}
						</ul>
					</details>
				</li>
			{/each}
		</ul>
	</details>
	<h2>Net changes ({view.current.net.length})</h2>
	{#if view.current.net.length === 0}
		<p>No exported changes from the imported save.</p>
	{/if}
	<ul>
		{#each view.current.net as patch, index (`${index}
:${patch.path}`)}
			<li>
				<details>
					<summary>
						{patch.op}:
						<code>{patch.path}</code>
					</summary>
					<pre>{JSON.stringify(patch, null, 2)}</pre>
				</details>
			</li>
		{/each}
	</ul>
	<details>
		<summary>Inventory operation sample</summary>
		<p>
			Reverse the host backpack to compare a compact action with its actual
			exported changes.
		</p>
		<button
			type="button"
			disabled={pending.current > 0}
			onclick={() => void reverse()}
		>
			Reverse backpack
		</button>
	</details>
	{#if error}
		<p role="alert">{error}</p>
	{/if}
{/if}

<style>
	h1 {
		font-family: "Pixelify Sans", sans-serif;
		font-size: 32px;
	}
	h2 {
		font-size: 25px;
		margin-top: 20px;
	}
	.undone {
		opacity: 0.6;
	}
	li {
		margin-block: 7px;
	}
	code,
	pre {
		font-size: 14px;
		overflow-wrap: anywhere;
	}
	pre {
		white-space: pre-wrap;
		max-height: 260px;
		overflow: auto;
		background: #ffedcc;
		padding: 10px;
	}
	summary {
		cursor: pointer;
	}
	button {
		font: inherit;
		min-height: 44px;
		padding: 5px 12px;
		color: #351b0e;
	}
	[role="alert"] {
		color: #8a1c19;
	}
</style>
