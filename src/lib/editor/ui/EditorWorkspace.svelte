<script lang="ts">
	import { Result } from "effect";
	import type { CommandResult } from "../command-result.ts";
	import CommandToasts from "./CommandToasts.svelte";
	import { useAtomValue } from "effect-atom-svelte";
	import type { EditorModel } from "../editor-model.ts";
	import { createRuneDraft } from "../field.svelte.ts";
	import EditorShell from "../../ui/frame/EditorShell.svelte";
	import SectionLink from "../../ui/frame/SectionLink.svelte";
	import CalendarPanel from "./CalendarPanel.svelte";
	import CharacterPanel from "./CharacterPanel.svelte";
	import FarmPanel from "./FarmPanel.svelte";
	import BundlePanel from "./BundlePanel.svelte";
	import ReviewPanel from "./ReviewPanel.svelte";
	interface Props {
		includeProofs?: boolean;
		downloading?: boolean;
		model: EditorModel;
		filename: string;
		onclose: () => void;
		ondownload: () => Promise<
			undefined | CommandResult<unknown, { message: string }>
		>;
	}
	let {
		model,
		filename,
		onclose,
		ondownload,
		includeProofs = false,
		downloading = false,
	}: Props = $props();

	// Hooks subscribe through the nearest file provider. Keep the accessor object:
	// destructuring .current would capture a stale non-reactive value.
	const view = useAtomValue(() => model.atomBindings.view);
	// The workspace owns the draft across section navigation. Keeping its panels
	// mounted preserves input and lets external revisions mark conflicts visibly.
	const dateDraft = createRuneDraft(() => model.dateField);
	let tab = $state("calendar");
	let inventoryOpened = $state(false);
	function chooseSection(section: string) {
		// Hidden panels retain their local state, so navigation explicitly finishes
		// any field gesture even when no native blur event accompanies the change.
		void model.edits.endActive();
		tab = section;
	}
	let error = $state("");
	async function perform(
		action: () => Promise<
			undefined | CommandResult<unknown, { message: string }>
		>,
	) {
		error = "";
		const result = await action();
		if (result && Result.isFailure(result)) error = result.failure.message;
	}
</script>

<div class="editor study-theme">
	<CommandToasts {model} />
	<EditorShell {onclose}>
		{#snippet header()}
			<header class="toolbar">
				<strong>Stardew Save Editor - V2</strong>
				<span>{filename}</span>
				<!-- History commands queue after a field's blur commit, preserving
				     the same click rather than disabling its target mid-gesture. -->
				<div class="buttons">
					<button
						type="button"
						disabled={!view.current?.canUndo}
						onclick={() => void perform(model.commands.undo)}
					>
						Undo
					</button>
					<button
						type="button"
						disabled={!view.current?.canRedo}
						onclick={() => void perform(model.commands.redo)}
					>
						Redo
					</button>
					<!-- Export joins the command queue after a field's blur commit;
					     disabling it during that commit would swallow the same click. -->
					<button
						type="button"
						class="export"
						disabled={downloading || dateDraft.current.dirty}
						aria-busy={downloading}
						aria-label="Export save"
						onclick={() => void perform(ondownload)}
					>
						{downloading ? "Exporting…" : "Export save"}
					</button>
				</div>
			</header>
		{/snippet}
		{#snippet navigation()}
			<nav aria-label="Editor sections">
				<SectionLink
					href="#inventory"
					label="Inventory"
					shortLabel="Inventory"
					icon="inventory"
					active={tab === "inventory"}
					onclick={() => {
						inventoryOpened = true;
						chooseSection("inventory");
					}}
				/>

				<SectionLink
					href="#character"
					label="Character"
					shortLabel="Skills"
					icon="character"
					active={tab === "character"}
					onclick={() => chooseSection("character")}
				/>

				<SectionLink
					href="#farm"
					label="Farm settings"
					shortLabel="Farm"
					icon="farm"
					active={tab === "farm"}
					onclick={() => chooseSection("farm")}
				/>
				<SectionLink
					href="#calendar"
					label="Date and weather"
					shortLabel="Calendar"
					icon="farm"
					active={tab === "calendar"}
					onclick={() => chooseSection("calendar")}
				/>

				<SectionLink
					href="#review"
					label="Review changes"
					shortLabel="Changes"
					icon="quests"
					active={tab === "review"}
					onclick={() => chooseSection("review")}
				/>
				{#if includeProofs}
					<SectionLink
						href="#bundles"
						label="Bundles"
						icon="community"
						active={tab === "bundles"}
						onclick={() => chooseSection("bundles")}
					/>
				{/if}
			</nav>
		{/snippet}
		{#if error}
			<p role="alert">{error}</p>
		{/if}
		{#if dateDraft.current.dirty}
			<p role="status">Apply or reload your date draft before exporting.</p>
		{/if}
		<!-- Load inventory code/catalog only when this section first opens; visible
		     sprites then request their sheets. This boundary can also load locale data
		     in future. Keep the consumer mounted so selection survives navigation. -->
		{#if inventoryOpened}
			<div hidden={tab !== "inventory"}>
				{#await import("./BackpackPanel.svelte")}
					<p role="status">Loading inventory…</p>
				{:then panel}
					<panel.default {model} />
				{:catch}
					<p role="alert">
						The inventory view could not be loaded. Reopen the editor to try
						again.
					</p>
				{/await}
			</div>
		{/if}
		<div hidden={tab !== "character"}><CharacterPanel {model} /></div>
		<div hidden={tab !== "farm"}><FarmPanel {model} /></div>
		<div hidden={tab !== "calendar"}>
			<CalendarPanel {model} draft={dateDraft} />
		</div>
		{#if includeProofs}
			<div hidden={tab !== "bundles"}>
				<BundlePanel {model} />
			</div>
		{/if}
		<div hidden={tab !== "review"}><ReviewPanel {model} {includeProofs} /></div>
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
			/* Section labels need two columns to keep complete words at phone widths. */
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		nav :global(a) {
			flex: 1;
			flex-direction: row;
			text-align: left;
		}
		.toolbar strong {
			flex-basis: 100%;
		}
		.toolbar span {
			display: none;
		}
	}
	@media (max-width: 600px) {
		/* Keep the inventory overview in reach: phone chrome uses one compact
		   tab row and smaller type instead of consuming half the viewport. */
		.editor {
			font-size: 18px;
			line-height: 1.3;
		}
		.toolbar {
			min-height: 0;
			padding: 8px 42px 8px 10px;
			gap: 8px;
		}
		.toolbar strong {
			font-size: 18px;
			line-height: 1.15;
		}
		.buttons {
			gap: 6px;
		}
		.buttons button {
			min-height: 36px;
			padding: 4px 9px;
			font-size: 17px;
		}
		nav {
			display: flex;
			flex-wrap: nowrap;
		}
		nav :global(a) {
			min-width: 0;
			min-height: 44px;
			padding: 4px;
			font-size: 16px;
			justify-content: center;
		}
		nav :global(.glyph) {
			display: none;
		}
		.editor :global(.content) {
			/* Keep text inside the parchment rim while reducing vertical chrome. */
			padding: 12px 20px;
		}
		.editor :global(h1) {
			font-size: 27px;
			margin: 0 0 12px;
		}
		.editor :global(h2) {
			font-size: 22px;
		}
		.editor :global(h3) {
			font-size: 20px;
		}
	}
</style>
