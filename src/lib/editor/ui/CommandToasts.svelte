<script lang="ts">
	import { useAtomValue } from "effect-atom-svelte";
	import type { EditorModel } from "../editor-model.ts";
	let { model }: { model: EditorModel } = $props();
	const notice = useAtomValue(() => model.atomBindings.notice);
	// One session-level presenter handles defects from every command. A newer
	// message resets the timeout, and unmount releases it without retaining a save.
	$effect(() => {
		const message = notice.current;
		const owner = model;
		if (!message) return;
		const timer = setTimeout(() => owner.dismissNotice(), 8000);
		return () => clearTimeout(timer);
	});
</script>

<div class="command-toasts" role="status" aria-live="polite">
	{#if notice.current}
		<div class="toast">
			<p>{notice.current.message}</p>
			<button
				type="button"
				onclick={() => model.dismissNotice()}
				aria-label="Dismiss notification"
			>
				Close
			</button>
		</div>
	{/if}
</div>

<style>
	.command-toasts {
		position: fixed;
		bottom: 20px;
		left: 50%;
		transform: translateX(-50%);
		width: min(500px, calc(100% - 32px));
		z-index: 100;
	}
	.toast {
		padding: 16px;
		background: #ffe2aa;
		color: #351b0e;
		border: 3px solid #8a1c19;
		box-shadow: 0 4px 12px #0005;
	}
	p {
		margin: 0 0 8px;
	}
	button {
		min-height: 40px;
		font: inherit;
	}
</style>
