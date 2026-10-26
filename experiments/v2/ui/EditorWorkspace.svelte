<script lang="ts">
	import { untrack } from "svelte";
	import type { EditorModel } from "../editor-model.ts";
	import { createDraft } from "../field.ts";
	import EditorShell from "../../../src/lib/ui/frame/EditorShell.svelte";
	import SectionLink from "../../../src/lib/ui/frame/SectionLink.svelte";
	import CalendarPanel from "./CalendarPanel.svelte";
	import BundlePanel from "./BundlePanel.svelte";
	import ReviewPanel from "./ReviewPanel.svelte";
	let {
		model,
		filename,
		onclose,
		ondownload,
	}: {
		model: EditorModel;
		filename: string;
		onclose: () => void;
		ondownload: () => Promise<void>;
	} = $props();
	const { view, pending, dateField } = untrack(() => model);
	const dateDraft = createDraft(dateField);
	let tab = $state("calendar");
	let error = $state("");
	async function perform(action: () => Promise<unknown>) {
		error = "";
		try {
			await action();
		} catch (cause) {
			error = String(cause);
		}
	}
</script>

<div class="editor study-theme">
	<EditorShell {onclose}>
		{#snippet header()}<header class="toolbar">
				<strong>Stardew Save Editor - V2</strong><span>{filename}</span>
				<div class="buttons">
					<button
						type="button"
						disabled={!$view?.canUndo || $pending > 0}
						onclick={() => void perform(model.undo)}>Undo</button
					><button
						type="button"
						disabled={!$view?.canRedo || $pending > 0}
						onclick={() => void perform(model.redo)}>Redo</button
					><button
						type="button"
						class="export"
						disabled={$pending > 0 || $dateDraft.dirty}
						onclick={() => void perform(ondownload)}>Export save</button
					>
				</div>
			</header>{/snippet}
		{#snippet navigation()}<nav aria-label="Editor sections">
				<SectionLink
					href="#calendar"
					label="Date and weather"
					icon="farm"
					active={tab === "calendar"}
					onclick={() => (tab = "calendar")}
				/><SectionLink
					href="#review"
					label="Review changes"
					icon="quests"
					active={tab === "review"}
					onclick={() => (tab = "review")}
				/>
				<SectionLink
					href="#bundles"
					label="Bundles"
					icon="community"
					active={tab === "bundles"}
					onclick={() => (tab = "bundles")}
				/>
			</nav>{/snippet}
		{#if error}<p role="alert">{error}</p>{/if}
		{#if $dateDraft.dirty}<p role="status">
				Apply or reload your date draft before exporting.
			</p>{/if}
		<div hidden={tab !== "calendar"}>
			<CalendarPanel {model} draft={dateDraft} />
		</div>
		<div hidden={tab !== "bundles"}><BundlePanel {model} /></div>
		<div hidden={tab !== "review"}><ReviewPanel {model} /></div>
	</EditorShell>
</div>

<style>
	.editor {
		width: min(1440px, 100%);
		margin: auto;
		--study-frame-height: calc(100dvh - 16px);
	}
	.toolbar {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 12px;
		min-height: 72px;
		padding: 12px 42px 12px 16px;
	}
	.toolbar strong {
		font-family: "Pixelify Sans", sans-serif;
		font-size: 23px;
		margin-right: auto;
	}
	.toolbar span {
		max-width: 180px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.buttons {
		display: flex;
		gap: 8px;
	}
	button {
		font: inherit;
		min-height: 40px;
		padding: 5px 10px;
		cursor: pointer;
		color: #351b0e;
	}
	button:disabled {
		opacity: 0.6;
		cursor: default;
	}
	.export {
		background: #248448;
		color: #fff6dc;
		border: 2px solid #24522a;
	}
	[role="alert"] {
		color: #8a1c19;
	}
	@media (max-width: 900px) {
		.editor {
			--study-frame-height: auto;
		}
		nav {
			display: flex;
			flex-wrap: wrap;
		}
		nav :global(a) {
			flex: 1;
		}
		.toolbar strong {
			flex-basis: 100%;
		}
		.toolbar span {
			display: none;
		}
	}
</style>
