<script lang="ts">
	import { Dialog } from "bits-ui";
	let { commit }: { commit: () => void } = $props();
	let bitsOpen = $state(false);
	let trigger = $state<HTMLButtonElement | null>(null);
	const portalTarget = $derived(
		trigger?.closest<HTMLElement>("[data-ui-theme]") ?? undefined,
	);
</script>

<Dialog.Root bind:open={bitsOpen}>
	<Dialog.Trigger bind:ref={trigger}>Reverse backpack…</Dialog.Trigger>
	<Dialog.Portal to={portalTarget}>
		<Dialog.Overlay class="dialog-overlay" />
		<Dialog.Content class="dialog-content">
			<Dialog.Title>Reverse backpack?</Dialog.Title>
			<Dialog.Description
				>Every slot moves, including empty slots. You can undo this action.</Dialog.Description
			>
			<Dialog.Close>Cancel</Dialog.Close>
			<button
				type="button"
				onclick={() => {
					commit();
					bitsOpen = false;
				}}>Reverse slots</button
			>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
