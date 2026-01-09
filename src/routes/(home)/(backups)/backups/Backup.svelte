<script lang="ts">
interface Props {
	backup: File;
	deleteFunc: () => void;
}

let { backup, deleteFunc }: Props = $props();

let date: Date = $derived(new Date(backup.lastModified));

const download = () => {
	const a = document.createElement("a");
	a.href = URL.createObjectURL(backup);
	a.download = backup.name;
	a.click();
};
</script>

<div class="wrapper">
	<div>
		<h4>{backup.name}</h4>
		<h5>{`${date.toLocaleDateString()} - ${date.toLocaleTimeString()}`}</h5>
		<small>{((backup.size >> 10) / 1024).toPrecision(3)} MB</small>
	</div>
	<div>
		<button aria-label="Download" onclick={download}>💾</button>
		<button aria-label="Delete" onclick={deleteFunc}>🗑️</button>
	</div>
</div>

<style>
	.wrapper {
		display: flex;
		flex-direction: row;
		gap: 8px;
		justify-content: space-between;
		padding: 2px;
	}

	.wrapper > div:first-child {
		display: flex;
		flex-direction: column;
		justify-content: start;
	}

	.wrapper > div:first-child > small {
		padding-left: 8px;
		color: rgba(0, 0, 0, 0.75);
	}

	.wrapper > div:nth-child(2) {
		display: flex;
		flex-direction: column;
		justify-content: space-evenly;
	}
</style>
