<script lang="ts">
    import type { HTMLSelectAttributes } from "svelte/elements";

    type Options<T extends string | number> = {
        label: string;
        value: T;
    }[];

    type Props<T extends string | number> = Omit<
        HTMLSelectAttributes,
        "value"
    > & {
        value: T;
        options: Options<T>;
    };

    let {
        value = $bindable(),
        options,
        ...props
    }: Props<string | number> = $props();

    let select: HTMLSelectElement | undefined;
    let safeValue = $state(value);

    function getter() {
        return value;
    }

    function setter(v: typeof value) {
        // Reset custom validity
        select?.setCustomValidity("");

        // Preemptive check for native validation
        select?.reportValidity();
        if (!select?.checkValidity()) {
            return;
        }

        // Try to set the value, then show any errors as a custom validity
        try {
            value = v;
        } catch (error) {
            if (!(error instanceof Error)) throw error;
            // Set the selected value to the default value, anyway
            select.value = safeValue.toString(); // I think this is fine
            select.setCustomValidity(error.message);
        }

        select.reportValidity();

        // Update the safe value
        safeValue = value;
    }

    function onblur() {
        // If the select has no value, reset to the default value
        const v = select?.value;
        if (!v) {
            // biome-ignore lint/style/noNonNullAssertion: <explanation>
            setter(options[0]!.value);
        }
    }
</script>

<select bind:this={select} bind:value={getter, setter} {onblur} {...props}>
    {#each options as option}
        <option value={option.value}>{option.label}</option>
    {/each}
</select>

<style>
    select {
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
        margin-left: 4px;
    }

    select:disabled {
        background-color: #de9a3c;
        color: #000;
    }

    select:focus {
        outline: none;
    }

    select:invalid {
        box-shadow: red 0 0 0 2px;
    }
</style>
