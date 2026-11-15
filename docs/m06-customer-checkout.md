# M06 — Customer cart and cash-on-delivery checkout

## Scope

M06 depends on M03 merchant stores and M04 products. The feature branch `feat/m06-customer-cart-checkout` adds:

- Public product cards with add-to-cart actions.
- Browser-persisted cart using local storage; cached client prices are presentation only and are never trusted for checkout.
- Cart quantity editing/removal and recipient details.
- One checkout submission can contain items from multiple stores. A single database transaction creates one separate order per store, each with the configured store delivery fee.
- COD is the only payment method in M06; new orders start with payment status `unpaid`.
- Super Admin delivery fee configuration per active store. An absent or disabled fee configuration blocks checkout. Zero IQD is permitted only when Super Admin explicitly configures it (free delivery).
- Database-side product-price lookup, published/active store checks, stock validation, stable row locking, stock decrement, and request-key idempotency to prevent duplicate orders after a retry or lost response.
- Order and line-item snapshots preserve product name, unit, price and quantity at checkout; historic order totals do not change when catalog prices change.
- Customer order history with store, status, item lines, subtotal, delivery fee and total.
- Customer cancellation only while the order remains `placed` and `unpaid`; tracked product stock is restored atomically.

## Financial boundaries

- No online checkout/payment gateway is integrated in M06.
- No wallet balance is created or changed by M06.
- No captain delivery assignment, 20% captain wallet debit or merchant commission settlement is implemented in M06.
- Customer is charged the configured store delivery fee as part of the COD order total; captain cash collection and commission accounting belong to M08/M09.
- One store creates one order row so each merchant has an independent preparation and delivery fee. A multi-store cart creates multiple order rows with one checkout group ID.
- The checkout RPC recalculates item prices and store delivery fees from PostgreSQL. Client-supplied prices, totals, store IDs or shipping values are not accepted.
- Product stock rows are locked in stable product ID order; the full checkout is rolled back if any item is unpublished, unavailable, out of stock, or belongs to a store without an active delivery fee.
- Quantities support up to three decimal places to match catalog stock quantities. Line totals are rounded to the nearest whole IQD in PostgreSQL.

## Database objects

Migration: `supabase/migrations/202611150006_customer_checkout_orders.sql`.

- `public.store_delivery_settings`: one Super Admin-controlled fee per active store.
- `public.orders`: one COD order per store, associated with a shared checkout group.
- `public.order_items`: immutable price/product snapshots for each order line.
- `public.set_store_delivery_fee`: Super Admin-only upsert RPC.
- `public.create_cod_checkout`: authenticated-customer-only transactional checkout RPC.
- `public.cancel_cod_order`: customer-only cancellation for their unpaid `placed` order with stock restoration.
- All three tables have RLS enabled. Direct client writes are revoked; only SELECT is granted, and all mutations go through checked database functions.
- Order RLS exposes each row to its customer, the owning merchant, or Super Admin. Order-item RLS follows its parent order.
- COD is guarded by a database CHECK constraint.

## Validation and release gates

M06 depends on M03 and M04 schema. M05 feature code is the base branch, but M06 SQL is designed not to depend on M05 wallet/post objects.

1. Run M03, M04 and M06 migrations on a separate non-production Supabase database in sequence.
2. Confirm a restorable production backup/PITR recovery point using the approved backup process.
3. Configure a test store delivery fee as Super Admin; verify missing/disabled settings block checkout and explicit zero fee is treated as free delivery.
4. Verify one-store and multi-store carts create one order per store and a shared checkout group.
5. Verify price changes between cart creation and checkout use the current database price.
6. Verify hidden/draft/archived products and inactive stores are rejected.
7. Verify insufficient stock rejects the entire multi-store checkout; no partial orders or stock changes remain.
8. Verify two concurrent checkouts cannot oversell tracked stock.
9. Verify duplicate product IDs, malformed UUIDs, negative/zero quantities, excessive quantities and more than three decimal places are rejected.
10. Verify anonymous users and non-customer roles cannot place orders.
11. Verify merchants can read only orders from their own store; customers see only their orders; Super Admin can inspect all orders.
12. Verify direct client INSERT/UPDATE/DELETE on orders, order items and delivery settings is denied.
13. Verify customer cancellation is allowed only while the order is unpaid and `placed`; cancellation restores tracked stock exactly once.
14. Verify once the merchant accepts the order, the customer cancellation RPC rejects it.
15. Verify repeated submission with the same checkout request key returns the existing order set and does not decrement inventory twice.
16. Verify a fresh checkout request key creates a new order set, even when the cart contents are identical.
17. Verify COD is the only payment method accepted and new payment status is always unpaid.

## Known boundaries for later phases

- M07 must add merchant acceptance/preparation, order status audit events, and controlled transition RPCs; every transition must lock the order row and validate its current status.
- M08 must add captain assignment, pickup/delivery proof, and the 20% delivery fee commission rule without splitting the cash fee collected from the customer.
- M09 must add captain/merchant wallet funding, immutable financial settlement entries and manual FastPay/FIB proof approval.
- M10 must add eligible delivered-order rewards, referral attribution and cashout approval/payment tracking.
- Inventory compensation after merchant/admin cancellation or after order rejection must be implemented in M07, using an idempotent state transition; M06 only restores stock for customer cancellation while status is still `placed`.

## Validation status

- Feature branch: `feat/m06-customer-cart-checkout`, based on M05 branch `feat/m05-posts-promotions`.
- GitHub Actions passed TypeScript, ESLint and production build on commit `14958466f5c4762be46c503051a28f008866feda`.
- Draft PR #6 targets `feat/m05-posts-promotions` so the phases remain sequential.
- Non-production SQL migration, RLS, concurrency and stock tests are still pending because no isolated Supabase development branch has been provisioned.
- The M06 migration is not applied to production. No mock orders, test customers or fake inventory are inserted into production.
