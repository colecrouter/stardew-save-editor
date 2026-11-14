import { configure } from "@testing-library/svelte";
import { testTimeouts } from "./timeouts.ts";

// Existing happy-dom suites share Browser Mode's assertion budget while they
// migrate. This covers waitFor and findBy queries without per-call options.
configure({ asyncUtilTimeout: testTimeouts.assertion });
