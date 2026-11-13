// Real full-file codec work needs an integration deadline under default worker
// concurrency. Hook and test-body deadlines are independent: opt in at the actual
// import/export boundary, leaving pure tests at their defaults. This is a stuck-test
// guard; measure latency separately with a probe for the same workload.
export const fullSaveTimeout = 30_000;
