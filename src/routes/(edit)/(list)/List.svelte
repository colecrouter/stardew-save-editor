<script lang="ts">
    import type { KV } from '$types/save/1.5';
    import ItemSprite from '../inventory/ItemSprite.svelte';
    import SmallItem from '../inventory/SmallItem.svelte';

    interface Props {
        keys: string[];
        values: KV[];
    }

    let { keys, values }: Props = $props();

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
            <div class="key">
                <div class="img">
                    <ItemSprite item={{ name: key }} />
                </div>
                {key}
            </div>

            <input
                type="checkbox"
                aria-label={key}
                checked={values.some((v) => v.key.string === key)}
                onchange={handleCheck} />
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
        margin: 2px 0;
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

    .key {
        display: flex;
        align-items: center;
        gap: 4px;
        padding-bottom: 2px;
    }

    .img {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
</style>
