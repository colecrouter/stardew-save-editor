<script lang="ts">
	import { RegistryProvider } from "effect-atom-svelte";
	import type { EditorModel } from "../../src/lib/editor/editor-model.ts";
	import StoragePanel from "../../src/lib/editor/ui/StoragePanel.svelte";
	let { model }: { model: EditorModel } = $props();
</script>

<RegistryProvider registry={model.atomBindings.registry}>
	<StoragePanel {model} />
</RegistryProvider>
