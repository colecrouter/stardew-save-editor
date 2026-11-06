<script lang="ts">
	import { RegistryProvider } from "effect-atom-svelte";
	import type { EditorModel } from "../../src/lib/editor/editor-model";
	import BackpackPanel from "../../src/lib/editor/ui/BackpackPanel.svelte";

	let { model }: { model: EditorModel } = $props();
</script>

<!-- Borrow the real file registry so external history commands publish through
     the same subscriptions as the application-owned backpack panel. -->
<RegistryProvider registry={model.atomBindings.registry}>
	<BackpackPanel {model} />
</RegistryProvider>
