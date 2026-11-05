<script lang="ts">
	import type { PregnancyDomain } from "../pregnancy-domain.ts";
	import CheckboxField from "./fields/CheckboxField.svelte";
	import NumberField from "./fields/NumberField.svelte";

	interface Props {
		pregnancy: PregnancyDomain;
	}
	let { pregnancy }: Props = $props();
</script>

<!-- Keep ordinary relationship browsing compact. The spouse row owns this
     disclosure; player marriages use the same summary above the villager list.
     Opening it only reveals controls and never edits the save or implies RNG. -->
{#if pregnancy.kind !== "none"}
	<details class="pregnancy" aria-label="Family planning">
		<summary>
			<span>
				{pregnancy.kind === "player" ? `${pregnancy.spouse} · ` : ""}Family
				planning
			</span>
			<span class="status">
				{pregnancy.expecting
					? pregnancy.dueDate
						? `Due ${pregnancy.dueDate}`
						: "Expecting a baby"
					: "Not expecting a baby"}
			</span>
		</summary>

		<div class="content">
			<p class="explanation">
				Set a due date directly to skip the overnight baby question. This edits
				the saved pregnancy; it does not create a child immediately.
			</p>

			<div class="controls">
				<CheckboxField field={pregnancy.expectingField} />

				<!-- Reserve the due-date controls while off. The domain disables the
				     field, so toggling pregnancy does not shift the surrounding layout. -->
				<NumberField field={pregnancy.daysField} />
				<p class="due-date">
					{pregnancy.expecting && pregnancy.dueDate
						? `Due ${pregnancy.dueDate}`
						: "No due date set"}
				</p>
			</div>

			<h3>Baby-question requirements</h3>
			<p>
				{pregnancy.eligible
					? "Saved requirements met"
					: "Not all saved requirements met"}
			</p>

			<ul>
				{#each pregnancy.requirements as requirement (requirement.label)}
					<li>
						<strong>
							{requirement.met === undefined
								? "Unknown"
								: requirement.met
									? "Met"
									: "Not met"}: {requirement.label}
						</strong>

						<span>{requirement.detail}</span>
					</li>
				{/each}
			</ul>

			<p>
				These are saved requirements, not a promise of a question tonight. The
				game also checks runtime conditions, including sleeping at home, and
				chooses overnight events at random.
				{#if pregnancy.kind === "player"}
					Both players must agree to the question.
				{/if}
			</p>
		</div>
	</details>
{/if}

<style>
	.pregnancy {
		font-size: 16px;
		min-width: 0;
	}
	summary {
		cursor: pointer;
		color: var(--study-muted, #694621);
		padding-block: 0.35rem;
		overflow-wrap: anywhere;
	}
	summary:focus-visible {
		outline: 2px solid var(--study-border, #b88b52);
		outline-offset: 2px;
	}
	.status {
		color: inherit;
		margin-left: 0.75rem;
	}
	.content {
		padding-block: 0.5rem;
		border-top: 1px solid var(--study-border, #b88b52);
	}
	h3 {
		margin: 0.75rem 0 0;
		font-size: 1rem;
	}
	.explanation {
		margin-block: 0.5rem;
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
	}
	.controls p {
		margin: 0;
		min-height: 1.3em;
	}
	.due-date {
		min-width: min(100%, 22rem);
		color: var(--study-muted, #694621);
	}
	ul {
		padding-inline-start: 1.25rem;
	}
	li {
		margin-block: 0.5rem;
	}
	li span {
		display: block;
		color: var(--study-muted, #815327);
	}
	@media (max-width: 480px) {
		.controls .due-date {
			min-height: 2.6em;
		}
		.status {
			display: block;
			margin: 0.25rem 0 0 1rem;
		}
	}
</style>
