<script lang="ts">
	import { tick, type Snippet } from "svelte";
	import StudyButton from "../../ui/kit/StudyButton.svelte";
	interface Notice {
		readonly key: string;
		readonly title: string;
		readonly summary?: string;
		readonly meta?: string;
		readonly status?: string;
	}
	let {
		label,
		tone = "town",
		items,
		empty,
		detail,
	}: {
		label: string;
		tone?: "town" | "qi";
		items: readonly Notice[];
		empty: string;
		detail: Snippet<[string]>;
	} = $props();
	let selected = $state<string>();
	let detailOpen = $state(false);
	let detailPanel = $state<HTMLDivElement>();
	let list = $state<HTMLElement>();
	const current = $derived(
		items.find((item) => item.key === selected) ?? items[0],
	);
	// Search, completion or removal may eliminate the selected notice. Never keep
	// an editor attached to a stale key; phones return to the remaining list.
	$effect.pre(() => {
		if (selected === undefined) {
			selected = items[0]?.key;
		} else if (!items.some((item) => item.key === selected)) {
			// Capture focus before keyed teardown removes the old controls. Searching
			// outside the detail must retain focus in the search input instead.
			const restoreFocus = detailPanel?.contains(document.activeElement);
			selected = items[0]?.key;
			detailOpen = false;
			if (restoreFocus) void tick().then(focusList);
		}
	});
	function focusList() {
		if (!list?.isConnected) return;
		const control = list.querySelector('[aria-pressed="true"]');
		if (control instanceof HTMLElement) control.focus();
		else list.focus();
	}

	async function choose(key: string) {
		selected = key;
		detailOpen = true;
		await tick();
		// Focus the newly revealed paper after mobile CSS swaps the visible surface.
		// On desktop this also places keyboard users beside the selected editor.
		detailPanel?.focus({ preventScroll: true });
		if (window.matchMedia("(max-width: 900px)").matches)
			detailPanel?.scrollIntoView({ block: "start" });
	}
	async function back() {
		detailOpen = false;
		await tick();
		focusList();
	}
</script>

<div class="notice-board" class:qi={tone === "qi"} data-detail={detailOpen}>
	<nav class="notice-list" aria-label={label} bind:this={list} tabindex="-1">
		{#each items as item (item.key)}
			<button
				type="button"
				class="notice"
				aria-pressed={current?.key === item.key}
				aria-label={[item.title, item.status, item.meta]
					.filter(Boolean)
					.join(" · ")}
				onclick={() => void choose(item.key)}
			>
				<strong>{item.title}</strong>

				{#if item.status}<span class="state">{item.status}</span>{/if}

				{#if item.summary}<span class="summary">{item.summary}</span>{/if}

				{#if item.meta}<span class="meta">{item.meta}</span>{/if}
			</button>
		{:else}
			<p class="empty">{empty}</p>
		{/each}
	</nav>

	{#if current}
		<div
			class="selected-notice"
			bind:this={detailPanel}
			tabindex="-1"
			role="group"
			aria-label="Selected notice"
			onfocusin={() => {
				// A desktop user may edit the default notice without choosing it first.
				// Retain that editor if the window then becomes a phone-sized layout.
				detailOpen = true;
			}}
		>
			<div class="back">
				<StudyButton onclick={() => void back()}>← Back to notices</StudyButton>
			</div>

			<!-- Keyed detail releases old field controllers before another target is
			     rendered. Selection itself never queues an edit or a history entry. -->
			{#key current.key}
				<div class="notice-content">
					{@render detail(current.key)}
				</div>
			{/key}
		</div>
	{/if}
</div>

<style>
	.notice-board {
		/* Fixed desktop columns keep filtering or longer details from resizing the
		   board. Each column owns its overflow; narrow layouts return to page flow. */
		--notice-height: clamp(360px, calc(100vh - 420px), 650px);
		--notice-ink: #432811;
		--notice-muted: #775632;
		--notice-rule: #d5b782;
		--notice-accent: #8a4d20;
		display: grid;
		grid-template-columns: minmax(220px, 0.8fr) minmax(0, 1.7fr);
		gap: 28px;
		align-items: start;
		padding: 24px;
		border: 6px solid #70401d;
		box-shadow:
			inset 0 0 0 3px #b9803f,
			0 3px #4c2b16;
		background: repeating-linear-gradient(
			0deg,
			#895623 0 44px,
			#74451e 44px 47px,
			#a26a30 47px 50px
		);
		color: var(--notice-ink);
	}
	.notice-board.qi {
		--notice-ink: #342b58;
		--notice-muted: #625a83;
		--notice-rule: #b9a7ce;
		--notice-accent: #6a4387;
		/* Native confirmation controls inherit this local palette, including their
		   dialogs. Keep the rest of the editor's warm button theme unchanged. */
		--ui-control-bg: #eee5f6;
		--ui-control-text: #432d62;
		--ui-border-dark: #74578f;
		--ui-border-light: #b39cc6;
		border-color: #39315a;
		box-shadow:
			inset 0 0 0 3px #74668e,
			0 3px #2c2545;
		background: repeating-linear-gradient(
			0deg,
			#514873 0 44px,
			#3f385f 44px 47px,
			#665780 47px 50px
		);
	}
	.notice-list {
		display: grid;
		align-content: start;
		gap: 20px;
		min-width: 0;
		height: var(--notice-height);
		overflow-y: auto;
		padding: 4px 6px 8px;
		scrollbar-color: #ceac75 #75451f;
	}
	.notice {
		position: relative;
		display: grid;
		gap: 6px;
		width: 100%;
		min-width: 0;
		padding: 22px 12px 12px;
		text-align: left;
		font: inherit;
		line-height: 1.2;
		color: var(--notice-ink);
		background: #ffefc9;
		border: 2px solid #d5b782;
		box-shadow: 3px 3px #43281166;
		cursor: pointer;
	}
	.qi .notice {
		background: #eee6f6;
		border-color: #b9a7ce;
	}
	.notice::before {
		content: "";
		position: absolute;
		width: 10px;
		height: 10px;
		border: 2px solid #354b51;
		background: #95abb1;
		box-shadow: 1px 2px #43281166;
		border-radius: 50%;
		top: 5px;
		left: calc(50% - 5px);
	}
	.notice[aria-pressed="true"] {
		outline: 3px solid #f5bf57;
		outline-offset: 0;
	}
	.qi .notice[aria-pressed="true"] {
		outline-color: #a0d7ed;
	}
	.notice:focus-visible {
		outline: 3px solid #53b5f0;
		outline-offset: 1px;
	}
	.notice strong {
		font-family: "Pixelify Sans", sans-serif;
		font-size: 20px;
		overflow-wrap: anywhere;
	}
	.state {
		color: var(--notice-accent);
		font-size: 17px;
	}
	.summary {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 1;
		line-clamp: 1;
		overflow: hidden;
		color: var(--notice-muted);
		font-size: 18px;
	}
	.meta {
		font-size: 17px;
		color: var(--notice-muted);
	}
	.selected-notice {
		display: flex;
		flex-direction: column;
		height: var(--notice-height);
		position: relative;
		min-width: 0;
		padding: 32px 24px 24px;
		background: #fff1d2;
		border: 2px solid #d5b782;
		box-shadow: 4px 4px #43281166;
	}
	.notice-content {
		min-height: 0;
		overflow-y: auto;
	}
	.qi :global(.study-button) {
		--button-ink: #432d62;
		--button-border: #74578f;
		--button-surface: #eee5f6;
		--button-hover: #e0d2ed;
		--button-top: #fbf7ff;
		--button-bottom: #c6afd9;
	}
	.qi :global(input[type="checkbox"]) {
		accent-color: #795499;
	}
	.qi .selected-notice {
		background: #f4edf9;
		border-color: #b9a7ce;
	}
	.selected-notice::before {
		content: "";
		position: absolute;
		top: -12px;
		left: calc(50% - 28px);
		width: 56px;
		height: 26px;
		background: #c9ba94aa;
		border-inline: 1px dashed #a99b7a;
		transform: rotate(-2deg);
		pointer-events: none;
	}
	.qi .selected-notice::before {
		background: #c1b4d2aa;
		border-color: #8b7d9d;
	}
	.selected-notice:focus-visible {
		outline: 3px solid #53b5f0;
		outline-offset: 3px;
	}
	.back {
		display: none;
	}
	.empty {
		background: #fff1d2;
		color: #432811;
		padding: 20px;
		margin: 0;
	}
	@media (max-width: 1100px) {
		.notice-board {
			padding: 20px 12px;
			gap: 18px;
			grid-template-columns: minmax(190px, 0.9fr) minmax(0, 1.5fr);
		}
		.selected-notice {
			padding: 28px 18px 18px;
		}
	}
	@media (max-width: 900px) {
		.notice-board {
			grid-template-columns: minmax(0, 1fr);
			padding: 24px 12px 16px;
		}
		.notice-list {
			height: auto;
			overflow: visible;
		}
		.selected-notice {
			height: auto;
		}
		.notice-content {
			overflow: visible;
		}
		.notice-board:not([data-detail="true"]) .selected-notice {
			display: none;
		}
		.notice-board[data-detail="true"] .notice-list {
			display: none;
		}
		.back {
			display: block;
			margin-bottom: 20px;
		}
	}
</style>
