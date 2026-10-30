<script lang="ts">
	import { Result } from "effect";
	import type { CommunityBundleDomain } from "../community-domain.ts";
	import type { CommandResult } from "../command-result.ts";
	import BackpackItemVisual from "./BackpackItemVisual.svelte";
	let { bundle }: { bundle: CommunityBundleDomain } = $props();
	let error = $state("");
	async function perform(
		action: () => Promise<CommandResult<unknown, { message: string }>>,
	) {
		error = "";
		const result = await action();
		if (result && Result.isFailure(result)) error = result.failure.message;
	}
</script>

<article aria-label={`${bundle.name} bundle`} class:complete={bundle.completed}>
	<header>
		<div>
			<h3>{bundle.name}</h3>
			<p>{bundle.submitted} / {bundle.needed} donations required</p>
		</div>
		<button
			type="button"
			disabled={!bundle.supported}
			onclick={() => void perform(() => bundle.complete(!bundle.completed))}
		>
			{bundle.completed ? "Reopen bundle" : "Complete bundle"}
		</button>
	</header>
	{#if bundle.reason}
		<p role="status">{bundle.reason}</p>
	{/if}
	{#if error}
		<p role="alert">{error}</p>
	{/if}
	<div class="requirements">
		{#each bundle.requirements as item (item.index)}
			<label class:donated={item.submitted}>
				<BackpackItemVisual visual={item.visual} />
				<span class="description">
					<strong>{item.name}</strong>
					<small>
						{item.currency
							? "Gold donation"
							: `${item.quantity} required${item.quality ? ` · quality ${item.quality}+` : ""}`}
					</small>
				</span>
				<input
					type="checkbox"
					checked={item.submitted}
					disabled={!bundle.supported}
					aria-label={`${item.name} donated`}
					onchange={(event) => {
						const value = event.currentTarget.checked;
						void perform(() => item.donate(value));
					}}
				/>
			</label>
		{/each}
	</div>
	{#if bundle.rewardItem}
		<footer>
			<div class="reward">
				<BackpackItemVisual visual={bundle.rewardItem.visual} />
				<span>
					Reward: {bundle.rewardItem.quantity} × {bundle.rewardItem.name}
				</span>
			</div>
			{#if bundle.id === 36}
				<span>No claimable item reward</span>
			{:else}
				<label class="availability">
					<input
						type="checkbox"
						checked={bundle.rewardAvailable}
						disabled={!bundle.supported ||
							!bundle.rewardSupported ||
							!bundle.completed}
						onchange={(event) => {
							const value = event.currentTarget.checked;
							void perform(() => bundle.rewardAvailability(value));
						}}
					/>
					Reward available in game
				</label>
			{/if}
		</footer>
	{/if}
</article>

<style>
	article {
		border: 1px solid #b88b51;
		border-radius: 10px;
		background: #fff8e8;
		padding: 18px;
		min-width: 0;
	}
	article.complete {
		border-color: #6b8745;
	}
	header,
	footer {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 12px;
		justify-content: space-between;
	}
	header {
		margin-bottom: 16px;
	}
	h3 {
		font-size: 22px;
		margin: 0;
	}
	header p {
		margin: 4px 0 0;
		font-size: 13px;
		color: #735436;
	}
	button {
		font: inherit;
		padding: 8px 12px;
		border: 1px solid #ac7e44;
		border-radius: 6px;
		background: #efd29a;
		color: inherit;
		cursor: pointer;
	}
	button:disabled,
	input:disabled {
		opacity: 0.55;
		cursor: default;
	}
	.requirements {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
		gap: 10px;
	}
	.requirements label {
		display: flex;
		gap: 12px;
		align-items: center;
		border: 1px solid #d7bd94;
		border-radius: 7px;
		padding: 12px;
	}
	.requirements label.donated {
		background: #e9edcf;
	}
	.description {
		display: grid;
		gap: 5px;
		flex: 1;
		font-size: 14px;
	}
	small {
		color: #6b5239;
		font-size: 12px;
	}
	input {
		flex: none;
		width: 19px;
		height: 19px;
		accent-color: #507635;
	}
	footer {
		border-top: 1px solid #dac09a;
		margin-top: 18px;
		padding-top: 14px;
		font-size: 13px;
	}
	.reward,
	.availability {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	[role="alert"] {
		color: #972e1c;
	}
</style>
