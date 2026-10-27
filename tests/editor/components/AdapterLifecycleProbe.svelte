<script lang="ts">
	import { RegistryProvider } from "effect-atom-svelte";
	import type { EditorModel } from "../../../src/lib/editor/editor-model.ts";
	import AdapterReadProbe from "./AdapterReadProbe.svelte";
	let { model }: { model: Pick<EditorModel, "atomBindings"> } = $props();
</script>

<!-- Borrow the same registry as the real workspace. This harness is imported
     explicitly by the browser proof and is not part of the shipped lab entry. -->
<RegistryProvider registry={model.atomBindings.registry}>
	<AdapterReadProbe {model} />
</RegistryProvider>
