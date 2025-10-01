<script lang="ts">
	import type { MailBox, MailFlag } from "$lib/proxies/Mail.svelte";
	import Tooltip from "$lib/ui/Tooltip.svelte";
	import type { Snippet } from "svelte";

	interface Props {
		mail: MailBox;
		flag: MailFlag;
		alt: string;
		children?: Snippet;
		[key: string]: unknown;
	}

	let { mail, flag, alt, children, ...props }: Props = $props();

	function toggle() {
		if (mail.has(flag)) {
			mail.delete(flag);
		} else {
			mail.add(flag);
		}
	}

	$effect(() => console.log(`mail has ${flag}: ${mail.has(flag)}`));
</script>

<Tooltip text={alt}>
	<button class:disabled={!mail.has(flag)} onclick={toggle} {...props}>
		{@render children?.()}
	</button>
</Tooltip>

<style>
	button {
		all: unset;
		font-size: 2em;
		cursor: pointer;
		text-shadow: -2px 2px 2px #000;
	}

	button:hover {
		outline: revert;
		opacity: 0.8 !important;
	}

	button.disabled {
		opacity: 0.4;
	}
</style>
