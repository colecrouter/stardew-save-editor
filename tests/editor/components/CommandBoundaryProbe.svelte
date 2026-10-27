<script lang="ts">
	import { RegistryProvider } from "effect-atom-svelte";
	import type { EditorModel } from "../../../src/lib/editor/editor-model.ts";
	import CommandToasts from "../../../src/lib/editor/ui/CommandToasts.svelte";
	import AdapterReadProbe from "./AdapterReadProbe.svelte";
	let { model }: { model: EditorModel } = $props();
</script>

<!-- Test-only presenter exercises the same borrowed registry as the workspace. -->
<RegistryProvider registry={model.atomBindings.registry}>
	<CommandToasts {model} />
	<AdapterReadProbe {model} />
</RegistryProvider>
