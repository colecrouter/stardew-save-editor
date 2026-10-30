<script lang="ts">
	import { useAtomValue } from "effect-atom-svelte";
	import type { EditorModel } from "../editor-model.ts";
	import { createQiOrderDomain } from "../qi-order-domain.ts";
	import { MAX_QI_OFFERS } from "../qi-order-operations.ts";
	import CheckboxField from "./fields/CheckboxField.svelte";
	import ConfirmAction from "./ConfirmAction.svelte";
	interface Props {
		model: EditorModel;
	}
	let { model }: Props = $props();
	const view = useAtomValue(() => model.atomBindings.view);
	const domain = $derived(
		view.current?.qiOrders
			? createQiOrderDomain(view.current.qiOrders, model)
			: undefined,
	);
	let search = $state("");
	const rows = $derived(
		(domain?.rows ?? []).filter((row) =>
			[row.name, row.description, row.key].some((value) =>
				value.toLowerCase().includes(search.trim().toLowerCase()),
			),
		),
	);
</script>

<div class="heading">
	<h1>Qi's orders</h1>
	<span>Shared by the farm</span>
</div>
<p>
	The Walnut Room board offers up to {MAX_QI_OFFERS} challenges. Making one active
	bypasses the weekly acceptance limit; progress and rewards are earned in-game. Changes
	are immediate and Undoable.
</p>
<div class="toolbar">
	<label>
		Search Qi orders <input
			class="ui-control"
			type="search"
			bind:value={search}
		/>
	</label>
	<strong>{domain?.offeredCount ?? 0}/{MAX_QI_OFFERS} board offers</strong>
</div>
{#if !domain?.supported}
	<p role="status">
		{domain?.reason ?? "Qi orders are unavailable."}
	</p>
{/if}
{#if domain}
	<div class="orders">
		{#each rows as row (row.key)}
			<section aria-label={`${row.name} order`}>
				<header>
					<h2>{row.name}</h2>
					{#if row.state}
						<span class="state">{row.state}</span>
					{/if}
				</header>
				<p>{row.description}</p>
				{#if row.known}
					<p class="meta">
						{row.rewardGems} Qi Gems · {row.duration} challenge
					</p>
				{/if}
				{#if row.deadline}
					<p class="meta">
						Deadline: {row.deadline}
					</p>
				{/if}
				<div class="actions">
					<CheckboxField field={row.offeredField} />
					{#if row.state === "InProgress"}
						<ConfirmAction
							title={`Cancel ${row.name}?`}
							description={row.cancelDescription}
							label={`Cancel ${row.name}`}
							disabled={!row.cancelAvailable}
							commit={row.cancel}
						/>
					{:else if row.state === undefined && row.known}
						<ConfirmAction
							title={`Start ${row.name}?`}
							description={row.acceptDescription}
							label={`Make ${row.name} active`}
							disabled={!row.acceptAvailable}
							commit={row.accept}
						/>
					{/if}
				</div>
			</section>
		{:else}
			<p>No Qi orders match your search.</p>
		{/each}
	</div>
{/if}

<style>
	.heading,
	.toolbar,
	header,
	.actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
	}
	h1,
	h2 {
		margin: 0;
	}
	h2 {
		font-size: 24px;
	}
	p {
		line-height: 1.4;
	}
	.toolbar {
		margin: 24px 0;
	}
	label {
		display: grid;
		gap: 8px;
	}
	input {
		font: inherit;
		min-height: 44px;
		max-width: 100%;
		box-sizing: border-box;
	}
	.orders {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 24px;
	}
	section {
		border-top: 1px solid #bb925e;
		padding: 20px 0;
		min-width: 0;
	}
	.meta,
	.state {
		font-size: 17px;
		color: #694621;
	}
	.actions {
		align-items: start;
		justify-content: start;
	}
	@media (max-width: 900px) {
		.orders {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	@media (max-width: 600px) {
		.toolbar label {
			width: 100%;
		}
	}
</style>
