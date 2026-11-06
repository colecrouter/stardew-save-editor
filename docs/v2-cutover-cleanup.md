# Cutover cleanup (#220)

After the cleanup PR lands, switch the default route, reconcile old links, verify
production import/edit/Undo/Redo/export/backups, and record rollback in the cutover
PR. Release stretch features do not block this foundation.

## Remove migration infrastructure

Move useful engine/transaction and native Node import tests out of
`experiments/v2` before deleting its package, forwarding modules, lab UI,
comparison implementations, proof launchers and obsolete CI commands. Keep
production smoke/profiling tools only where they remain useful for maintenance.
Choose the legacy route redirect/fallback policy explicitly; retain useful
preservation tests independently of those routes.

## Keep documentation minimal

Keep current user guidance and concise contributor/test instructions. Fold lasting
architecture contracts or compatibility constraints into those maintained entry
points. Remove the V2 status checklist once cutover is complete.

Delete migration discovery, porting, audit, reconciliation and proof reports,
including migration-only profiling dumps. Do not create a historical archive.
Git history and merged PRs retain that context and attribution. Move any still
relevant limitation into current guidance or an actionable issue before deletion,
and repair remaining links. This checklist itself retires when #220 is complete.
