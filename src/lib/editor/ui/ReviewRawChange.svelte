<script lang="ts">
	import type { JsonPatch } from "effect";
	import type { ImmutableView } from "../immutable-view.ts";
	let { patch }: { patch: ImmutableView<JsonPatch.JsonPatch[number]> } =
		$props();
	let open = $state(false);
</script>

<!-- Large replacement payloads are serialized only when explicitly inspected. -->
<details bind:open>
	<summary>
		{patch.op}
		<code>{patch.path || "/"}</code>
	</summary>

	{#if open}
		<pre>{JSON.stringify(patch, null, 2)}</pre>
	{/if}
</details>

<style>
	summary {
		cursor: pointer;
		min-height: 44px;
		padding-block: 8px;
	}
	code,
	pre {
		font: 14px/1.4 monospace;
		overflow-wrap: anywhere;
	}
	code {
		margin-left: 8px;
	}
	pre {
		white-space: pre-wrap;
		max-height: 300px;
		overflow: auto;
		padding: 12px;
		margin: 0 0 12px;
		background: #f3dfb8;
	}
</style>
