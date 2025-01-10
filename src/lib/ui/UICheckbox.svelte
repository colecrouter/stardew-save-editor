<script lang="ts">
    import type { HTMLInputAttributes } from "svelte/elements";

    type Props = Omit<HTMLInputAttributes, "value" | "checked"> & {
        checked: boolean;
    };

    let { checked = $bindable(), ...props }: Props = $props();
</script>

<input type="checkbox" bind:checked {...props} />

<style>
    input {
        border-radius: 4px;
        border: solid 2px;
        border-bottom-color: #9c613b;
        border-left-color: #9c613b;
        border-right-color: #6f3b31;
        border-top-color: #6f3b31;
        background-color: #f9bb65;
        box-shadow:
            inset -2px 2px 0 #e38813,
            -2px 2px 1px rgba(0, 0, 0, 0.2);
    }

    input {
        position: relative;
        appearance: none;
        width: 1.2rem;
        height: 1.2rem;
        border: solid 2px #5b2b2a;
        box-shadow: inset -2px 2px 0px #976d42;
        cursor: pointer;
    }

    input:hover {
        filter: brightness(1.15);
    }

    input:checked::after {
        position: absolute;
        top: -0.25rem;
        left: -0.175rem;
        color: transparent;
        text-shadow: 0 0 0 #32c523;
        content: "❌";
        font-weight: bold;
        font-size: 1.2em;
    }
</style>
