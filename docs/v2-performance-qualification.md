# Final browser performance qualification

This closes the remaining #201 measurement work on production application source
`b8b5186f02cc4e2a7da1316c1f56eb5fe0de318f` (merged #252). No application
optimization is included. Edit, queue, trusted-input and lifecycle results satisfy
the agreed qualification, subject to the existing synthetic large-save navigation
exception and the nonreproduced first-Inventory outlier recorded below. The raw
matrix deliberately retains `hardTimingGatesPass: false` for that outlier; this
is a qualified assessment, not a claim that every observation met its target.
Default-route cutover remains #220.

## Reproduce and inspect

Use Node 24, installed dependencies, and an installed Playwright Chromium. Build
and start the production preview in one terminal, then run each measurement
sequentially with no concurrent builds/tests:

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4269
```

```sh
node --import tsx tools/qualify-editor-browser.mjs --output /tmp/browser-lab.json
node --import tsx tools/qualify-editor-browser.mjs --mode memory --output /tmp/browser-memory.json
```

Pass `--chromium /absolute/path/to/chromium` when the installed Playwright browser
needs an explicit executable. `--case narrow4x-fixture` repeats one case; the five
case names are in the harness. `--url` overrides the production URL. Timing failures
exit nonzero while preserving samples. The final harness also rejects changing
source fingerprints; that exit-status guard and a fixture comment spacing fix
were added after measurement, without changing application or probe behavior.
The recorded harness digest identifies the measured version.

Raw samples, exact observed values, key events and source fingerprints:

- [Five-case matrix](profiling/editor-browser-qualification.json)
- [First Inventory repeat 1](profiling/editor-browser-repeat-1.json) and
  [repeat 2](profiling/editor-browser-repeat-2.json)
- [Six lifecycle cycles](profiling/editor-browser-memory.json)
- [Pending Review diagnostic](profiling/editor-browser-pending-review.json) and
  [idle Review diagnostic](profiling/editor-browser-idle-review.json)

Apple M4 Pro, macOS kernel 27.2.0, Chromium 156.0.8078.4, Playwright 1.56.1,
Node 24.22.2. Desktop is 1440×900 at 1× CPU; narrow is 390×900 with CDP 4× CPU
throttling. These are laboratory configurations, not real phones, Safari,
physical paint, hardware input latency, field INP or population percentiles.
The earlier historical edit probe used 844px height; this run follows the later
900px trusted-delay configuration. The UI now has 14 sections after merging
Appearance into Character. Timing runs were sequential without our test/build
workloads; other workstation processes were not disabled. Runtime load is recorded.

Public fixture: 6,652,242 bytes, SHA-256
`16f6dfe6a94d84f7a3c36e26850b0efc9bfb72ddd1261857d1bab57a0529aae9`.
Shared deterministic large fixture: 7,063,901 bytes, 9,012 numbered slots, SHA-256
`4a2e22fa6e3e004d09b224ecc7710facfc9d63b389accb5bdf0c2c603e7a825a`.
The generator is shared with the Node profiler and retains the historical bytes.
All retained runs have matching before/after source fingerprints.

## Immediate edits and queued work

Each feature has two warmups, eight settled trusted character inputs, eight
nominally 50ms driver-paced trusted inputs and eight same-task synthetic updates.
Farm observes a cached authoritative raw review-patch value; quantity observes
the cached committed slot badge. Neither uses the optimistic input value as
commit evidence. Observers do not scan the whole inventory. All accepted values
must appear in exact order; each phase verifies authoritative grouped Undo/Redo.

Settled median budgets are 200ms public /300ms large. Queue budget is 1,000ms
for eight accepted same-task updates. Values below are milliseconds; each settled
cell gives median / maximum. Every edit and queue gate passes.

| Case                    | Farm settled | Quantity settled | Farm queue drain | Quantity queue drain |
| ----------------------- | -----------: | ---------------: | ---------------: | -------------------: |
| desktop-fixture         |  20.2 / 21.1 |      24.3 / 26.1 |             37.3 |                107.3 |
| desktop-large           |  25.9 / 26.6 |      27.4 / 29.9 |             82.4 |                170.7 |
| narrow4x-fixture        |  23.8 / 34.0 |      54.9 / 62.0 |            148.4 |                362.7 |
| narrow4x-large          |  43.3 / 54.2 |     91.6 / 102.4 |            297.1 |                626.2 |
| narrow4x-large-all-open |  59.8 / 66.0 |    100.1 / 104.5 |            384.6 |                741.7 |

All 240 accepted inputs in the five-case matrix are observed (160 trusted,
80 synthetic). Final values, authoritative grouped Undo/Redo, original export
filename and the complete parsed exported document are exact. The only expected
changes are the shared Farm name and host Parsnip stack. No application page
errors or document horizontal overflow occurred. These focused checks supplement
previous replacement/cancellation/invalid-edit ownership regressions; they do not
repeat every feature interaction.

Driver pacing backpressures: actual input spacing ranges from 55.4ms to 316.4ms.
The all-open large quantity case has 271.6–316.4ms spacing; it does not establish
fixed-rate hardware typing capacity. Its paced maximum commit is 111.2ms. Synthetic
burst draining is separately measured and is not trusted typing or INP.

## Trusted input delay

The capture bound is capture-listener `performance.now()` minus the DOM event
timestamp, separate from input-to-commit latency. Every field has exactly 48
trusted character keydown/keypress/keyup events, excluding shortcut keys. All
480 captured events have finite nonnegative bounds below the agreed 100ms limit.
Exact type/timestamp matching against field-targeted Event Timing corroborates
121 events; the other 359 observations are unavailable under the API's 16ms
minimum duration filter, not zero-delay observations.

| Case                    | Farm max capture bound | Quantity max capture bound | Event Timing matches / captured |
| ----------------------- | ---------------------: | -------------------------: | ------------------------------: |
| desktop-fixture         |                  0.5ms |                      0.4ms |                           57/96 |
| desktop-large           |                  0.5ms |                      0.4ms |                           30/96 |
| narrow4x-fixture        |                  2.1ms |                      2.1ms |                            8/96 |
| narrow4x-large          |                  1.8ms |                      1.5ms |                           22/96 |
| narrow4x-large-all-open |                  2.6ms |                      7.0ms |                            4/96 |

## Navigation and the outlier

Navigation records a renderer-side click to meaningful active-section DOM and the
next animation-frame opportunity, not physical paint. First Inventory is measured
before edits. Later traversal is explicitly named `postEditTraversal`, not first
show. Warm passes follow mounting all 14 sections and completing deferred Review
comparison work. Other warm sections are below 100ms; the large-save exceptions
remain visible below.

| Case                    | First Inventory | Warm Inventory (three samples) | Warm Storage          | Warm Character        |
| ----------------------- | --------------: | ------------------------------ | --------------------- | --------------------- |
| desktop-fixture         |            22.3 | 15.0 / 16.8 / 16.5             | 16.9 / 16.7 / 15.9    | 15.9 / 16.4 / 15.6    |
| desktop-large           |            26.3 | 18.0 / 16.1 / 14.3             | 136.1 / 148.0 / 141.7 | 37.5 / 34.8 / 34.4    |
| narrow4x-fixture        |           438.0 | 17.8 / 13.5 / 16.8             | 11.6 / 14.2 / 14.5    | 11.6 / 16.3 / 15.1    |
| narrow4x-large          |           107.2 | 32.4 / 31.1 / 31.3             | 652.7 / 534.5 / 526.4 | 111.3 / 128.4 / 113.5 |
| narrow4x-large-all-open |           102.0 | 35.2 / 34.1 / 31.5             | 573.6 / 584.6 / 560.8 | 110.0 / 118.3 / 120.2 |

First-Inventory budgets are 250ms public /500ms large. The matrix's narrow public
438ms observation misses; two separate same-harness controlled repeats measured
96.7ms and 108.9ms, with their other gates passing. The cause remains unidentified;
these repeats show nonreproduction, not proof of a root cause or that the outlier
did not occur. Keep it in the maximum and raw failure result. This is the issue's
agreed controlled-repeat disposition, not a new architecture or threshold change.

Synthetic large Storage misses the general 100ms warm target at desktop as well
as 4× CPU. Preserve visible container contents under the accepted large-storage
navigation exception. Character's 110–128ms warm misses remain in the previously
accepted marginal full-UI synthetic stress category; do not call them under budget.
No real-save interaction problem was established by these showing costs.

An earlier diagnostic left Review before its deferred comparison finished. Its
following Inventory transition took about 400–436ms because pending work still
occupied the main thread. Completing the comparison before warm transitions
changed that diagnostic's Inventory samples to 41.6 /31.6 /33.3ms, with application
code unchanged. The comparison wait itself was 409ms; current large-matrix waits
are about 401–404ms. This remains real first-comparison/pending-work cost. The
settled warm probe isolates idle navigation; it does not claim navigating during
pending Review is equally fast. Review exposes pending state and has no agreed
first-comparison numeric gate. Both diagnostics are retained.

## Lifecycle and heap

One page survives six alternating public/large import → mount all sections → Farm
and quantity edits → grouped Undo/Redo → Review → exact export → Exit cycles.
The first viewport is 390×900, subsequent cycles 1440×900, all at 1× CPU. Each
closed sample follows a nine-second cleanup window and three CDP forced GCs.
Decimal MB below measure renderer JS heap only, not process/worker/peak memory.

| Cycle | Fixture | Open heap MB | Closed heap MB |
| ----- | ------- | -----------: | -------------: |
| 1     | public  |        27.79 |          14.24 |
| 2     | large   |       210.44 |          19.36 |
| 3     | public  |        33.75 |          19.81 |
| 4     | large   |       211.25 |          19.94 |
| 5     | public  |        34.44 |          20.38 |
| 6     | large   |       212.13 |          20.42 |

After first large-save warmup, closed heap grows 19.36→20.42MB (~1.05MB).
Like-for-like large cycles are 19.36 /19.94 /20.42MB; modest continuing growth
is present and must remain reported. There is no recurring 6.65–7.06MB save-sized
accumulation in this finite series. This meets the agreed qualified retention
criterion, not an absolute memory ceiling or proof of leak freedom. All cycles
have exact exports, zero tracked octet-stream download URLs, zero download anchors,
no probe reference and no page errors after Exit. One blob worker persists through
all six cycles; these counters and renderer heap do not prove worker-state release.
Earlier #224 ownership/lifecycle regressions remain relevant evidence.

## Disposition

Independent read-only harness/results review found no blocker and supported
closure with the outlier, navigation exceptions and heap limitations explicit.
Its source-stability exit-status nit was fixed. The owner confirmed the final
manual VoiceOver, native section menu and macOS overscroll checks; #218/#219 are
closed. File import/export device acceptance also retains the owner's explicit
provenance acceptance of the unchanged download mechanism, rather than a new
claim of hardware performance certification.

No speculative optimization remains required by #201. Revisit performance when a
reproducible regression or representative real-save/device usability problem
provides evidence. #220 owns the separate cutover decision.

Validation: production build, `npm run check` (zero Svelte errors/warnings),
`npm run format:check`, and a bounded Node profiler smoke run
(`--samples 4 --extra-chests 1`) pass. The browser matrix, two controlled repeats
and six-cycle lifecycle run supply the behavior checks for the new harness.
No production feature code changed.
