<script lang="ts">
	import { untrack } from "svelte";
	import type { EditorModel } from "../../src/lib/editor/editor-model.ts";
	import { createAppearanceDomain } from "../../src/lib/editor/appearance-domain.ts";
	import StepperField from "../../src/lib/editor/ui/fields/StepperField.svelte";
	let {
		model,
		holdPublication = false,
	}: { model: EditorModel; holdPublication?: boolean } = $props();
	// Each harness mount owns one file model, matching the application workspace.
	const bindings = untrack(() => model.atomBindings);
	let view = $state.raw(bindings.registry.get(bindings.view));
	// Use the actual published field descriptors, including Undo and queued writes.
	// The test subscription is owned by this mount and released during teardown.
	$effect(() =>
		bindings.registry.subscribe(bindings.view, (next) => {
			if (!holdPublication) view = next;
		}),
	);
	$effect(() => {
		if (!holdPublication) view = bindings.registry.get(bindings.view);
	});

	const domain = $derived(
		view && view.appearances[0]
			? createAppearanceDomain(view.appearances[0], model)
			: undefined,
	);
	const field = $derived(
		domain?.numbers.find((entry) => entry.label === "Skin"),
	);
</script>

{#if field}
	<StepperField {field} />
{/if}
