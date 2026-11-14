import { configure } from "@testing-library/svelte";
import { testTimeouts } from "./timeouts.ts";

// Existing Testing Library tests and native browser assertions use one retry
// budget. This covers waitFor and findBy queries without per-call options.
configure({ asyncUtilTimeout: testTimeouts.assertion });
