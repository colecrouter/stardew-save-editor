<script lang="ts">
    import type { KV } from '$types/save/1.5';

    export let keys: string[];
    export let values: KV[]; // 'values' is a bit misleading, more like "which keys are true"

    const handleCheck = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const key = target.ariaLabel!;
        const value = target.checked;

        if (value) {
            values.push({ key: { string: key }, value: { int: 0 } });
        } else {
            const index = values.findIndex((v) => v.key.string === key);
            values.splice(index, 1);
        }
    };
</script>

<div class="wrapper">
    {#each keys as key}
        <label class="entry">
            {key}
            <input type="checkbox" aria-label={key} checked={values.some((v) => v.key.string === key)} on:change={handleCheck} />
        </label>
    {/each}
</div>

<style>
    .wrapper {
        display: flex;
        flex-direction: column;
        height: 20rem;
        overflow-y: scroll;
    }

    .entry {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: #5b2b2a 1px solid;
        padding-left: 0.5em;
        margin: 0.1em 0;
    }

    input[type='checkbox'] {
        position: relative;
        appearance: none;
        width: 1.2rem;
        height: 1.2rem;
        border: solid 2px #5b2b2a;
        box-shadow: inset -2px 2px 0px #976d42;
        cursor: pointer;
    }

    input[type='checkbox']:hover {
        filter: brightness(1.15);
    }

    input[type='checkbox']:checked::after {
        position: absolute;
        top: -0.25rem;
        left: -0.175rem;
        color: transparent;
        text-shadow: 0 0 0 #32c523;
        content: '❌';
        font-weight: bold;
        font-size: 1.2em;
    }
</style>
