# SHAKH STORE — M05–M07 QA Execution Log

**Updated:** 2026-11-16  
**Repository:** `sardarwalikhano/shakh2027`  
**Scope:** M05 Posts/Promotions/Wallet/Ledger; M06 Cart/Checkout; M07 Order Lifecycle  
**Test database:** User-provided non-production Supabase project `hzekyhcihhddehxndfyg`  
**Production:** Not modified. No production migration, backup, restore, or data write was performed.  
**Release decision:** HOLD. Do not merge PRs #5–#7 and do not start M08 until all release gates pass.

## Status definitions

- `PASS`: executed and observed result matches expected result, with evidence.
- `FAIL`: executed and observed result differs from expected result.
- `BLOCKED`: execution attempted but an external prerequisite prevented a valid result.
- `NOT RUN`: no verified execution evidence is available.
- `STRUCTURAL PASS`: database structure/permissions were inspected; this is not an application behavior test.

## Environment and source revisions

| Item | Recorded value |
|---|---|
| M05 PR #5 head SHA | `126a82b0701a751b482df739c1fb2dbb989992ef` |
| M06 PR #6 head SHA | `a92dc65beb937fbeceac86ca98cdb35604bf8b5b` |
| M07 PR #7 head SHA | `18e33d12d693c3282fe4331f8b1a7bf70d6c7f24` |
| M05 CI | PASS (GitHub Actions run #123, as previously observed) |
| M06 CI | PASS (GitHub Actions run #141, as previously observed) |
| M07 CI | PASS (GitHub Actions run #140, as previously observed) |
| M06 Vercel Preview | READY for recorded M06 head SHA |
| M05 Vercel Preview | BLOCKED / not verified for current head SHA; prior failure was reported as deployment rate limit |
| M07 Vercel Preview | BLOCKED / not verified for current head SHA; prior failure was reported as deployment rate limit |

These CI/Preview observations are historical snapshots from the prior QA session. Recheck current run and deployment status before release.

## Database migration record

The following migrations were reported successfully applied to the non-production database:

1. `202611150001_auth_roles.sql`
2. `202611150002_user_roles_assigned_by_index.sql`
3. `202611150003_merchant_stores.sql`
4. `202611150004_catalog_products.sql`
5. `202611150005_posts_promotions_wallets.sql`
6. `202611150006_customer_checkout_orders.sql`
7. `202611150007_order_lifecycle.sql`
8. `20261115171606_m05_m06_rls_policy_hardening.sql`

**Migration history verification:** NOT RUN in this log; query `list_migrations` again and compare the exact database migration ledger to this list before relying on it.

## Structural database checks

**Result:** STRUCTURAL PASS — 11/11 boolean assertions were reported true in the prior inspection. Raw query output is not attached to this log, so rerun and preserve the SQL/result as release evidence.

| ID | Assertion | Prior observed result |
|---|---|---|
| DB-01 | All public tables have RLS enabled | TRUE |
| DB-02 | anon cannot execute `public.rls_auto_enable()` | TRUE |
| DB-03 | authenticated cannot execute `public.rls_auto_enable()` | TRUE |
| DB-04 | anon cannot insert into wallets | TRUE |
| DB-05 | authenticated cannot insert into wallets directly | TRUE |
| DB-06 | authenticated cannot update wallet ledger directly | TRUE |
| DB-07 | immutable wallet-ledger trigger exists | TRUE |
| DB-08 | immutable order-status-event trigger exists | TRUE |
| DB-09 | exactly one active platform-owned SHAKH STORE exists | TRUE |
| DB-10 | platform wallet available/reserved balance is zero | TRUE |
| DB-11 | no test Auth users were left behind | TRUE |

These are structural assertions, not proof that all user workflows work correctly.

## Functional QA matrix — 12 required tests

No raw execution evidence for these 12 workflow tests is available in the current record. They remain NOT RUN until rerun with isolated fixtures, role-specific JWT/auth context, and verified rollback.

| ID | Test | Expected result | Status |
|---|---|---|---|
| QA-01 | Anonymous/published Posts RLS | Anonymous users can read only published/visible posts; drafts/private posts remain hidden | NOT RUN |
| QA-02 | Merchant role and Store Ownership | Merchant can access only its own store's permitted records; cross-store access is denied | NOT RUN |
| QA-03 | Super Admin Store Scope | Super Admin can perform authorized platform-wide actions; ordinary admin/merchant cannot exceed scope | NOT RUN |
| QA-04 | Wallet Balance and Read Permissions | Owner/admin reads follow policy; balances are derived from ledger and cannot be client-forged | NOT RUN |
| QA-05 | Ledger Immutability and Direct Write Denial | Direct client insert/update/delete is denied; approved server-side ledger operation is auditable | NOT RUN |
| QA-06 | Promotion Reservation and Concurrency | Capacity/eligibility constraints hold under concurrent reservation attempts; no over-reservation | NOT RUN |
| QA-07 | Checkout Price and Input Validation | Server recalculates prices/totals and rejects tampered, invalid, or unavailable input | NOT RUN |
| QA-08 | Multi-store Checkout and Delivery Fee | Store grouping and delivery-fee calculation match defined business rules; no cross-store leakage | NOT RUN |
| QA-09 | Inventory Lock and Overselling | Concurrent checkout cannot sell more than available stock | NOT RUN |
| QA-10 | Checkout Idempotency | Repeating the same idempotency key does not create duplicate orders/charges/reservations | NOT RUN |
| QA-11 | Order Transition and Actor Authorization | Only permitted actors can perform valid state transitions; invalid transitions are rejected | NOT RUN |
| QA-12 | Cancellation, Stock Restore and Audit Events | Authorized cancellation restores stock once and records immutable audit/status events | NOT RUN |

## Additional findings requiring follow-up

| ID | Finding | Required action | Status |
|---|---|---|---|
| SEC-01 | 15 public SECURITY DEFINER functions were reported executable by authenticated | Inventory signatures, grants, safe search_path, auth.uid/role checks, and test each authorization boundary; do not blanket-revoke | OPEN |
| PERF-01 | Two foreign keys reported without supporting indexes | Confirm exact constraints and query patterns; add indexes via a new forward-only migration if justified | OPEN |
| DB-12 | One duplicate read policy reported on `store_delivery_settings` | Confirm policy names/expressions and remove redundancy only in a new migration | OPEN |
| AUTH-01 | Current database role enum was reported missing `admin` and `produce_vendor` | Reconcile app role contract with DB enum in a separate M00/M03 scope; do not fold into M05–M07 silently | OPEN |
| STORE-01 | `stores_type_allowed` was reported not to include `produce` | Confirm intended store-type contract and implement additive forward-only migration if approved | OPEN |
| APP-01 | Screenshots show blank catalog/product pages and a Supabase/schema warning on `daim-post.online` | Production root cause remains unverified; obtain read-only evidence/authorization before diagnosing Production data/schema | BLOCKED |

## Execution record template

Append one entry for every execution. Never overwrite a prior result; record reruns as a new attempt.

| Field | Required value |
|---|---|
| Test ID / attempt | e.g. QA-07 / attempt 2 |
| Timestamp (UTC) | ISO-8601 |
| Environment | Non-production project ref |
| Git SHA | Exact commit SHA under test |
| Setup / fixtures | IDs and role context; no secrets |
| Expected | Exact assertion |
| Actual | Observed result / SQL output / test report |
| Status | PASS / FAIL / BLOCKED / NOT RUN |
| Evidence | CI run, test output, SQL result, or log reference |
| Cleanup | Rollback confirmed; no residual fixture rows |
| Defect / fix | Issue reference and forward-only migration if applicable |

## Release gates

- [ ] Re-run and save the migration-ledger verification.
- [ ] Re-run the 11 structural assertions and retain raw output.
- [ ] Execute QA-01 through QA-12 with isolated test fixtures and rollback.
- [ ] Review all 15 SECURITY DEFINER functions and test authorization boundaries.
- [ ] Resolve or explicitly accept the role/store-type contract findings.
- [ ] Add justified indexes / remove duplicate policy only through new forward-only migration(s).
- [ ] Re-run CI on exact final PR head SHAs.
- [ ] Verify Vercel Preview deployment SHA for each PR.
- [ ] Obtain code review and close all blocking review threads.
- [ ] Confirm no production changes and no test data residue.

**Current decision: HOLD.** No PR merge; no M08; no Production changes.
