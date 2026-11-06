<script lang="ts">
	import { Result } from "effect";
	import type { CommunityBundleDomain } from "../community-domain.ts";
	import type { CommandResult } from "../command-result.ts";
	import BackpackItemVisual from "./BackpackItemVisual.svelte";
	import CommunityRequirementsEditor from "./CommunityRequirementsEditor.svelte";
	import QualityBadge from "./QualityBadge.svelte";
	import StudyButton from "../../ui/kit/StudyButton.svelte";
	import StudyAlert from "../../ui/kit/StudyAlert.svelte";
	import StudyIcon from "../../ui/StudyIcon.svelte";
	let {
		bundle,
		disabled = false,
	}: { bundle: CommunityBundleDomain; disabled?: boolean } = $props();
	let error = $state("");
	async function perform(
		action: () => Promise<CommandResult<unknown, { message: string }>>,
	) {
		error = "";
		const result = await action();
		if (!result) return false;
		if (Result.isFailure(result)) {
			error = result.failure.message;
			return false;
		}
		return true;
	}
	async function donate(
		event: Event & { currentTarget: HTMLInputElement },
		item: CommunityBundleDomain["requirements"][number],
	) {
		const control = event.currentTarget;
		const accepted = await perform(() => item.donate(control.checked));
		// Native checkboxes toggle before the command completes. Rejected work must
		// return to the latest projection, including any intervening Undo/Redo.
		if (!accepted && control.isConnected)
			control.checked =
				bundle.requirements.find((row) => row.index === item.index)
					?.submitted ?? false;
	}
	async function reward(event: Event & { currentTarget: HTMLInputElement }) {
		const control = event.currentTarget;
		const accepted = await perform(() =>
			bundle.rewardAvailability(control.checked),
		);
		if (!accepted && control.isConnected)
			control.checked = bundle.rewardAvailable;
	}
</script>

<article aria-label={`${bundle.name} bundle`} class:complete={bundle.completed}>
	<header>
		<div class="bundle-heading">
			<div class="seal" aria-hidden="true">
				{#if bundle.seal}
					<BackpackItemVisual visual={bundle.seal} />
				{:else}
					<StudyIcon name="community" size={40} />
				{/if}
			</div>

			<div>
				<h3>{bundle.name}</h3>

				<p class="donation-count">
					{bundle.submitted} / {bundle.needed} donations required
				</p>
			</div>
		</div>

		<StudyButton
			intent={bundle.completed ? "neutral" : "constructive"}
			disabled={disabled || !bundle.supported}
			onclick={() => void perform(() => bundle.complete(!bundle.completed))}
		>
			{bundle.completed ? "Reopen bundle" : "Complete bundle"}
		</StudyButton>
	</header>

	<div class="edit-requirements">
		<CommunityRequirementsEditor {bundle} {disabled} />
	</div>

	{#if bundle.reason}
		<p role="status" class="bundle-note">{bundle.reason}</p>
	{/if}

	{#if error}
		<StudyAlert
			title="Bundle could not be changed"
			tone="danger"
			live="assertive"
		>
			<p>{error}</p>
		</StudyAlert>
	{/if}

	<div class="requirements">
		{#each bundle.requirements as item (item.index)}
			<label class:donated={item.submitted}>
				{#if !item.currency}
					<div class="item-visual">
						<BackpackItemVisual visual={item.visual} />
					</div>
				{/if}

				<span class="description">
					<span class="item-name">{item.name}</span>

					<span class="requirement-detail">
						{#if item.currency}
							Gold donation
						{:else}
							{item.quantity} required

							{#if item.quality}
								<span class="quality">
									<QualityBadge quality={item.quality} />
									{item.qualityLabel} or better
								</span>
							{/if}
						{/if}
					</span>
				</span>

				<input
					type="checkbox"
					checked={item.submitted}
					disabled={disabled || !bundle.supported}
					aria-label={`${item.name} donated`}
					onchange={(event) => void donate(event, item)}
				/>
			</label>
		{/each}
	</div>

	{#if bundle.rewardItem}
		<footer>
			<div class="reward">
				<BackpackItemVisual visual={bundle.rewardItem.visual} />

				<span>
					<span class="reward-label">Bundle reward</span>
					{bundle.rewardItem.quantity} × {bundle.rewardItem.name}
				</span>
			</div>

			{#if bundle.id === 36}
				<span class="bundle-note">No claimable item reward</span>
			{:else}
				<label class="availability">
					<input
						type="checkbox"
						checked={bundle.rewardAvailable}
						disabled={disabled ||
							!bundle.supported ||
							!bundle.rewardSupported ||
							!bundle.completed}
						onchange={(event) => void reward(event)}
					/>

					Reward available in game
				</label>
			{/if}
		</footer>
	{/if}
</article>

<style>
	article {
		border: 2px solid #b98b52;
		background: #fff0d0;
		padding: 20px;
		min-width: 0;
	}
	.edit-requirements {
		margin-bottom: 16px;
	}
	article.complete {
		border-color: #648045;
	}
	header,
	footer {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 16px;
		justify-content: space-between;
	}
	header {
		margin-bottom: 20px;
	}
	.bundle-heading {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
	}
	.seal {
		display: grid;
		place-items: center;
		width: 48px;
		height: 48px;
		flex: none;
	}
	.seal :global(.visual) {
		transform: scale(1.5);
	}
	h3 {
		font-size: 23px;
		margin: 0;
		overflow-wrap: anywhere;
	}
	.donation-count {
		margin: 6px 0 0;
		font-size: 18px;
		color: #694621;
	}
	.bundle-note {
		font-size: 18px;
		color: #694621;
		margin: 0 0 16px;
	}
	.requirements {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 190px), 1fr));
		gap: 8px;
	}
	.requirements label {
		display: flex;
		gap: 10px;
		align-items: center;
		min-height: 76px;
		border: 1px solid #d1b181;
		padding: 10px;
		background: #fff5df;
	}
	.requirements label.donated {
		background: #e5edcb;
		border-color: #8aa364;
	}
	.item-visual {
		flex: none;
		width: 32px;
		display: grid;
		place-items: center;
	}
	.description {
		display: grid;
		gap: 6px;
		flex: 1;
		min-width: 0;
	}
	.item-name {
		font-size: 20px;
		overflow-wrap: anywhere;
	}
	.requirement-detail {
		color: #694621;
		font-size: 17px;
		line-height: 1.25;
	}
	.quality {
		display: flex;
		gap: 4px;
		align-items: center;
		margin-top: 4px;
	}
	input {
		flex: none;
		width: 24px;
		height: 24px;
		margin: 0;
		accent-color: #35763a;
		cursor: pointer;
	}
	input:focus-visible {
		outline: 3px solid #176fb4;
		outline-offset: 3px;
	}
	input:disabled {
		opacity: 0.6;
		cursor: default;
	}
	footer {
		border-top: 1px solid #b98b52;
		margin-top: 20px;
		padding-top: 16px;
		font-size: 18px;
	}
	.reward,
	.availability {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.reward span {
		display: grid;
		gap: 4px;
	}
	.reward-label {
		color: #694621;
		font-size: 16px;
	}
	.availability {
		min-height: 44px;
	}
	@media (max-width: 600px) {
		article {
			padding: 16px;
		}
		h3 {
			font-size: 21px;
		}
		.requirements {
			grid-template-columns: minmax(0, 1fr);
		}
		header :global(.study-button) {
			width: 100%;
		}
	}
</style>
