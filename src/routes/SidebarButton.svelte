<!-- svelte-ignore a11y-click-events-have-key-events -->
<div on:click>
    <slot />
</div>

<style>
    div {
        background-color: #ffc677;
        border-radius: 2px;
        box-shadow: 0 0 0 2px #b14e05, 0 0 0 4px #dc7b05, 0 0 0 6px #5b2b29;
        width: fit-content;
        height: fit-content;
        margin: 6px;
        cursor: pointer;
        text-shadow: 0 0 2px #000;
        user-select: none;
    }
</style>
