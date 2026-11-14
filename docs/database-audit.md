# Supabase database audit — 2026-11-14

Project: SHAKH STORE
Project ref: ewulzprizvbgypzaogez
Database engine: PostgreSQL 17.11
Audit mode: read-only catalog inspection and Supabase advisors

## Observed public tables

1. captain_commission_settings
2. captain_commissions
3. notifications
4. order_items
5. orders
6. products
7. stores
8. wallet_accounts
9. wallet_cashout_requests
10. wallet_entries
11. wallet_transactions

The database has existing records. The observed table summaries included two stores, one product, one order, and six notifications. Other audited tables were empty at audit time. No migration history was recorded by Supabase.

## Blueprint gaps

The approved Database Blueprint includes identity/profile and role assignment, merchant membership, category configuration, product variants and images, inventory movement, posts and reward campaigns, referral attribution, carts and checkout, delivery assignment/history, merchant commission rules/assessments, wallet top-ups, payout review, addresses, payment records, order status history, refund workflow, system settings and audit logs.

These structures are not present in the current public schema. The existing 11-table schema is an earlier partial implementation, not the approved full blueprint.

## Business-rule conflicts

- Existing cashout request/review functions hardcode a 75% customer payout and 25% platform fee. This percentage was not approved in the SHAKH STORE Blueprint. The approved rule is customer payout request followed by Super Admin review and external payment; no percentage split was specified.
- Captain commission trigger creates an accrued commission record on delivery, but the approved rule requires a 20% commission debit from the captain's prepaid internal wallet and blocks new order acceptance when the wallet cannot cover commission.
- The current store type constraint does not include Baqal or a dedicated platform-owned SHAKH STORE store type.
- Product rows allow store_id to be null, while the current order placement routine rejects platform products with a null store. This does not support the approved dedicated SHAKH STORE marketplace behavior.
- Merchant per-unit commission, reserved reward budgets, first-valid referral attribution within 30 days, FastPay/FIB top-up review, and top-up evidence are not represented by the observed schema.

## Security findings

- public.captain_commission_settings has RLS enabled but no policy.
- public.request_wallet_cashout(bigint, text) is SECURITY DEFINER and executable by authenticated users. It contains the unapproved 75/25 payout split.
- Auth leaked-password protection is disabled according to Supabase Security Advisors.
- Supabase Performance Advisors report seven unindexed foreign keys and multiple permissive SELECT policies on orders, order_items, products and stores.
- SECURITY DEFINER routines that accept caller-supplied user IDs need explicit authorization checks inside the database function, not merely in a frontend.

## Required controls before database migrations

1. Obtain and verify a restorable backup/export of the current database, including schema and data.
2. Capture a baseline of current rows, constraints, indexes, policies, grants, triggers, functions and storage configuration.
3. Reconcile the 11-table implementation with the approved Database Blueprint. Preserve existing rows and IDs; do not reset or truncate.
4. Resolve the cashout policy explicitly: no 75/25 fee may be assumed. Keep payouts as Super Admin-reviewed external payments unless the user separately approves a different policy.
5. Design additive, reversible migrations with preflight checks and rollback instructions.
6. Review SECURITY DEFINER functions, RPC grants, RLS policies and Data API exposure before enabling any new workflow.
7. Apply migrations only after the backup and migration plan are verified.

## Current change status

No SQL schema changes, migrations, policy changes, data updates, or user-account changes were made during this audit.
