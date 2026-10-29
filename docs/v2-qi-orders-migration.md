# Qi special orders migration

Qi orders are shared world state, independent of the selected farmer. The panel
retains the vanilla template catalog, search, the two-offer board limit, explicit
activation and cancellation. Board checkboxes use shared discrete fields. Starting
or cancelling an order is a confirmed atomic transaction with exact Undo/Redo.
Terminal and unsupported imported orders remain visible and read-only.

## Creation and deadlines

Fresh records use generated objective/reward templates, localization tokens,
empty participant/reward-claim state and unapplied special rules. The random seed
is generated inside the Effect transaction; nothing is inserted while viewing.
Starting directly bypasses the board's weekly acceptance limit, like v1. If the
board is full and the challenge was not offered, the earliest uniquely identified
supported Qi offer in template order is evicted as part of the same transaction.
Duplicate, non-Qi or already-active records cannot be selected for eviction.

New deadlines match `SpecialOrder.SetDuration`: weekly and two-week orders align
to the current week's start, monthly orders to the season start, and short orders
to the current world day. This corrects v1's fresh full-duration calculation when
starting a weekly/monthly challenge partway through its board period. Existing
saved deadlines are never rewritten merely by opening the view.

## Cancellation boundaries

Cancellation removes only the supported InProgress target. Its applied mine or
Skull Cavern difficulty contribution is decremented only if no retained active
order uses the same applied rule. Shrine/other contributions remain. Mine-order
lowest-floor state is reset when the mine rule is removed. Unknown or malformed
rule state makes a target unavailable instead of guessing cleanup.

This retains v1's direct-save scope: cancellation does not simulate gameplay,
refund donated items, remove existing Qi Beans/Fruit, or clear cooking item tags.
The confirmation explicitly says existing items remain. Finished orders and
per-player reward/participant state are left for the in-game journal.

Tests cover the board cap, full-board activation/eviction, unknown/duplicate
preservation, template XML roundtrips, game-aligned deadlines, shared difficulty
cleanup, confirmed UI actions, navigation retention and exact Undo/Redo.
