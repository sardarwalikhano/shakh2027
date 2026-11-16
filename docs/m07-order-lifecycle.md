# M07 — Order lifecycle and merchant preparation

## Scope

M07 is the next sequential phase after M06 on branch \`feat/m07-order-lifecycle\`. It adds:

- A merchant order queue at \`/dashboard/merchant/orders\`.
- Merchant actions to accept, prepare, mark ready for captain pickup, or cancel an order before captain assignment.
- Super Admin order oversight at \`/dashboard/admin/orders\` and a restricted administrative cancellation action.
- An append-only \`public.order_status_events\` history with the actor, role, prior status, next status, reason and timestamp.
- A database trigger that records the initial \`placed\` event within the same transaction as every M06 checkout order.
- Backfill of the initial placed event for existing orders when M07 is applied, plus a historical cancellation event for orders already cancelled by M06 before audit logging existed.
- Customer visibility of the status history in \`/dashboard/customer/orders\`.
- Atomic restoration of tracked inventory on a valid merchant, Super Admin or customer cancellation.
- Request-key idempotency and an order-row lock so retrying a cancellation cannot restore stock twice.

## Allowed transitions

| Actor | Current status | Next status | Rule |
| --- | --- | --- | --- |
| Merchant | placed | accepted | Only the owner of the active store with the matching database role |
| Merchant | placed | cancelled | A reason of 3–500 characters is required |
| Merchant | accepted | preparing | Store ownership and role are rechecked in PostgreSQL |
| Merchant | accepted | cancelled | Tracked stock is restored in the same transaction |
| Merchant | preparing | ready_for_pickup | Marks preparation complete; does not assign a captain |
| Merchant | preparing | cancelled | Tracked stock is restored in the same transaction |
| Merchant | ready_for_pickup | cancelled | Allowed only before captain assignment |
| Customer | placed + unpaid | cancelled | Preserves the M06 rule; a deterministic request key makes retries safe |
| Super Admin | placed, accepted, preparing or ready_for_pickup | cancelled | Requires an explicit reason; not available after captain assignment |

M07 does not create captain assignment, pickup or delivery transitions. Statuses \`assigned\`, \`picked_up\` and \`delivered\` remain reserved for M08. A merchant cannot skip preparation states or advance an order that has already moved into the captain workflow.

## Database objects

Migration: \`supabase/migrations/202611150007_order_lifecycle.sql\`.

- \`public.order_status_events\`: immutable lifecycle audit entries, visible only when the caller can read the parent order.
- \`private.record_order_creation_event()\`: records the first \`placed\` event transactionally for new orders.
- \`private.apply_order_transition(...)\`: internal transition worker. It locks the order row, verifies actor permissions, checks the request key, restores tracked stock when required, changes the order status and writes the event atomically.
- \`public.merchant_transition_order(...)\`: merchant-only status transition RPC.
- \`public.admin_cancel_order(...)\`: Super Admin-only cancellation RPC before captain assignment.
- \`public.cancel_cod_order(uuid)\`: retains the M06 API but routes customer cancellation through the M07 audit and stock-compensation worker.

All SECURITY DEFINER functions pin \`search_path\`. Internal functions are not executable by browser roles. Public RPC execution is granted only to authenticated users; the database still checks the actual role and store ownership. The event table has RLS enabled, no client write grants, and an immutability trigger for UPDATE/DELETE. Explicit table grants are retained for Supabase Data API access.

## Stock and financial boundaries

- Inventory is restored only when a real status transition to \`cancelled\` succeeds.
- The order row is locked before idempotency is checked; replaying the same request returns the original event and does not restore stock again.
- Product rows with tracked stock are locked in stable product-ID order before their quantities are restored.
- Products with untracked stock (\`stock_quantity IS NULL\`) remain untracked; no artificial inventory is created.
- If restoration would exceed the database stock column's representable range, the transaction fails and requires an operator to correct the stock value before retrying.
- M07 does not mark COD payments as paid, create wallet credits/debits, settle merchant commission, or charge captain commission.
- The customer continues to pay the configured delivery fee as part of the COD total. Captain cash collection and the 20% prepaid-wallet commission remain M08/M09 work.

## Security and QA matrix

1. A merchant can read and transition orders only for a store it owns and the corresponding database role.
2. A merchant with a different merchant role cannot manage another store category.
3. A customer cannot invoke merchant or admin transition RPCs.
4. A Super Admin can cancel before captain assignment but cannot accept or prepare a merchant order through the merchant RPC.
5. A merchant cannot set \`assigned\`, \`picked_up\` or \`delivered\` through the M07 RPC.
6. \`placed → preparing\`, \`accepted → ready_for_pickup\`, and other skipped transitions are rejected.
7. Customer cancellation is limited to the customer's own unpaid \`placed\` order.
8. The legacy M06 customer cancellation RPC writes a status event after M07 replacement.
9. A cancellation reason shorter than 3 characters or longer than 500 characters is rejected.
10. Every new checkout order has exactly one initial \`placed\` event in the same transaction.
11. Existing M06 orders are backfilled with one initial event; pre-M07 customer cancellations also receive a second historical cancellation event; rerunning either insert does not duplicate it.
12. Customers, store owners and Super Admin can read only the history of orders visible to them.
13. Anonymous users cannot read order or status-history rows.
14. Direct client INSERT/UPDATE/DELETE on \`order_status_events\` is denied.
15. UPDATE/DELETE of an event is rejected by its database trigger.
16. Replaying the same request key returns the original event without a second stock increment.
17. Reusing the same key with a different status, reason, actor or role is rejected.
18. Two concurrent cancellations cannot restore the same order quantities twice.
19. Tracked stock is restored exactly once; null/untracked stock remains null.
20. If the stock maximum would be exceeded, the cancellation and event insert roll back together.
21. A merchant cannot cancel an order after it enters the captain assignment workflow.
22. COD payment status is unchanged by every M07 transition.

## Release gates

M07 depends on M03 stores, M04 products and M06 orders. Apply migrations in dependency order on an isolated non-production database:

1. M03 merchant stores.
2. M04 product catalog.
3. M06 cart, delivery settings and orders.
4. M07 order lifecycle.

Before any production migration:

- Verify the exact target project ref and the migration history again.
- Confirm a restorable production backup/PITR recovery point and a tested restore procedure.
- Run the full RLS, transition, idempotency and stock-restoration matrix on non-production.
- Confirm M05 is applied in the planned release sequence before promoting the chained M06 feature branch, even though M06's SQL objects do not directly call M05 objects.
- Obtain explicit approval for the production migration window.

The active production project remains \`zuxywfixaawupwgtbugi\`. This M07 migration is not applied to production. No development Supabase branch or verified restorable backup was available during this update. Do not apply M03–M07 production DDL until the release gates are met.

## Next phase

M08 owns captain availability, assignment, acceptance, pickup and delivery confirmation. It must extend the same audit trail and transition worker without allowing a merchant to mutate captain-owned states. Captain delivery cash handling must preserve the rule that the captain collects 100% of the delivery fee while the 20% commission is debited separately from the prepaid captain wallet; wallet debit is not implemented by M07.
