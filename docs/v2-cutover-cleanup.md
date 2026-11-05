# Cutover cleanup and retained evidence

This is the remaining retirement boundary for #220. Test housekeeping in #228
removes duplicated setup and CI execution; it does not silently discard old
coverage or perform the default-route switch. The current application is `/v2`.

## Experiments and labs

The standalone lab at `experiments/v2/ui`, its Vite config, proof launchers and
plain/store/Atom comparison implementations were migration tools, not a supported
fallback application. They should retire during cutover, after their remaining
useful assertions have an owned home. The production frame/controls/engine are
already application-owned; forwarding modules are compatibility paths.

Before removing the experiment package or lockfile:

1. Move authoritative history/transaction/identity/save suites from `*.effect.ts`
   into a clearly owned engine suite. Preserve meaningful regression cases; do not
   replace them with superficial duplicate tests or omit them from discovery.
2. Preserve native Node codec/import checks in a separate Node runner. Confirm that
   root dependency resolution provides their actual Effect/runtime requirements;
   keep explicit `.ts` imports and the no-Vite boundary.
3. Classify comparison-only assertions and demos explicitly. Plain/store/Atom UI
   comparisons and obsolete proof selectors can be removed once their production
   lifecycle assertions are retained. Do not retain a second editor runtime merely
   to keep a historical comparison executable.
4. Remove lab/proof scripts, forwarding modules, obsolete package dependencies and
   CI jobs only after the replacement commands pass. Update contributor/test links
   in the same change. Retain production profiling/smoke tools under `tools`.

The legacy SvelteKit route group is a separate fallback/rollback policy decision.
Choose whether to keep redirects or a temporary explicit fallback, document the
rollback commit/deployment, then remove obsolete paths deliberately. Do not infer
that deleting the standalone lab authorizes deleting legacy preservation tests.

## Documentation

Keep a small active entry point: `v2-status.md`, contributor/test commands, current
field/domain/review contracts, supported feature/mobile guidance and the cutover
rollback note. Update these to the actual default route when it changes.

Dated discovery, porting, migration, audit and workflow-proof reports are historical
evidence. Consolidate or move them to a clearly labelled archive during cutover,
fixing inbound relative links rather than leaving broken references. Remove obsolete
run instructions from the active path. Their history is useful, but it should not
compete with the current extension contract.

Keep reproducible performance evidence (`docs/profiling` plus qualification reports)
and contributor reconciliation/attribution. Source hashes and workload descriptions
explain accepted limitations; they are not disposable just because measurements are
old. Do not regenerate or relabel old measurements as results for a newer commit.

## Ready for cutover versus cut over

After the final cleanup PR and its checks are accepted, the remaining work is #220:
default-route/link behavior, deliberate legacy/lab retirement, documented rollback,
and a production import/edit/Undo/Redo/export/original-backup check on that route.
The [test map](../tests/README.md) and retained browser smoke give those checks a
reproducible starting point. The V2 release stretch milestone does not delay this
foundation boundary.
