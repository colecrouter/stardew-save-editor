<script lang="ts">
	import "./styles.css";
	import { Dialog } from "bits-ui";
	import type { Snippet } from "svelte";
	let {
		trigger,
		title,
		description,
		children,
		actions,
		open = $bindable(false),
		dismissible = true,
		disabled = false,
	}: {
		trigger: string;
		title: string;
		description?: string;
		children?: Snippet;
		actions?: Snippet<[() => void]>;
		open?: boolean;
		dismissible?: boolean;
		disabled?: boolean;
	} = $props();
	// One dismissal policy covers Escape, outside interaction and close controls.
	// Domain owners may lock it during a coordinated commit and keep errors inside.
	const close = () => {
		if (dismissible) open = false;
	};
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger class="study-kit study-button" {disabled}>
		{trigger}
	</Dialog.Trigger>

	<Dialog.Portal>
		<Dialog.Overlay class="study-overlay" />

		<Dialog.Content
			class="study-kit study-dialog"
			onEscapeKeydown={(event) => {
				if (!dismissible) event.preventDefault();
			}}
			onInteractOutside={(event) => {
				if (!dismissible) event.preventDefault();
			}}
		>
			<div class="study-dialog-heading">
				<Dialog.Title level={2} class="study-dialog-title">
					{title}
				</Dialog.Title>

				<Dialog.Close
					class="study-close"
					aria-label="Close dialog"
					disabled={!dismissible}
				>
					<svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20">
						<path
							d="m5 5 10 10M15 5 5 15"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						/>
					</svg>
				</Dialog.Close>
			</div>

			{#if description}
				<Dialog.Description class="study-dialog-description">
					{description}
				</Dialog.Description>
			{/if}

			{#if children}
				<div class="study-dialog-body">{@render children()}</div>
			{/if}

			{#if actions}
				<div class="study-dialog-actions">{@render actions(close)}</div>
			{/if}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
