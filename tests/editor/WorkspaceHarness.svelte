<script lang="ts">
	import { RegistryProvider } from "effect-atom-svelte";
	import type { EditorModel } from "../../src/lib/editor/editor-model";
	import EditorWorkspace from "../../src/lib/editor/ui/EditorWorkspace.svelte";

	let { model }: { model: EditorModel } = $props();
</script>

<!-- Render the real workspace so farmer controls, navigation and Undo share the
     same file-owned subscriptions and command boundary as the application. -->
<RegistryProvider registry={model.atomBindings.registry}>
	<EditorWorkspace
		{model}
		filename="Character test"
		onclose={() => {}}
		ondownload={() => model.commands.export()}
	/>
</RegistryProvider>
