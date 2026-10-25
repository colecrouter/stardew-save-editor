<script lang="ts">
	import { Dialog } from "bits-ui";
	let { commit }: { commit: () => void } = $props();
	let bitsOpen = $state(false);
</script>

<Dialog.Root bind:open={bitsOpen}>
	<Dialog.Trigger>Reverse backpack…</Dialog.Trigger>
	<Dialog.Portal>
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
