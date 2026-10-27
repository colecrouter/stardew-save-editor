<script lang="ts">
	import { RegistryProvider } from "effect-atom-svelte";
	import type { EditorModel } from "../../editor-model.ts";
	import AdapterReadProbe from "./AdapterReadProbe.svelte";
	let { model }: { model: EditorModel } = $props();
</script>

<!-- Borrow the same registry as the real workspace. This harness is imported
     explicitly by the browser proof and is not part of the shipped lab entry. -->
<RegistryProvider registry={model.atomBindings.registry}>
	<AdapterReadProbe {model} />
</RegistryProvider>
