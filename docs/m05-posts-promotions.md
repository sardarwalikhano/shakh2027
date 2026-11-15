# M05 — Posts, promotions and reward-budget reservation

## Scope

M05 builds on M03 stores and M04 products. The feature branch adds:

- Merchant and Super Admin post drafting, publication and archive actions.
- Two post types: general announcements and product promotions.
- A public feed at `/posts` that reads only published posts visible under database RLS.
- An official platform feed/store for Super Admin; merchants operate only inside their own active approved store.
- Promotion definition with a fixed IQD reward per eligible product unit, a maximum number of eligible units, and an end date in Iraq time.
- Merchant wallet accounts with available/reserved IQD balances.
- An immutable wallet ledger with database-enforced UPDATE/DELETE rejection.
- An atomic promotion publication RPC: the full `reward_per_unit_iqd × max_reward_units` budget is moved from available to reserved before the promotion is published.
- An atomic archive RPC that returns the unused reserved amount to the available balance and writes a ledger entry.
- Private, database-enforced store ownership and role checks for every write.

## Financial boundaries and not-yet-implemented work

- Merchant wallets are created with a zero balance. No fictitious top-up balance is inserted.
- FastPay/FIB top-ups remain in M09 and require user proof plus Super Admin manual approval until official provider integration is independently established.
- Customer reward settlement after delivered/completed orders is not implemented in M05; it belongs to the order/reward lifecycle phases.
- A separate order-level merchant commission settlement is not implemented by this migration. The promotion reward budget must not be mistaken for a completed sale commission/settlement engine.
- Captain wallets and 20% delivery-fee commission debit are not enabled by this M05 migration; those belong to M08/M09.
- Cashout, referrals and withdrawal payment are later phases.
- No promotion can be published unless the merchant wallet has sufficient available IQD to reserve the entire defined budget.

## Database objects

Migration: `supabase/migrations/202611150005_posts_promotions_wallets.sql`.

- `public.wallets`: one zero-balance merchant wallet for each active store; captain/customer account types are supported by the schema for later phases.
- `public.wallet_ledger`: append-only monetary audit log; direct client INSERT/UPDATE/DELETE privileges are revoked and an immutability trigger blocks UPDATE/DELETE.
- `public.posts`: store-scoped announcements and promotions.
- `public.promotion_budget_reservations`: tracks initial and remaining reward budget and eligible units.
- Storage bucket `post-images`: public read, manager-only upload/delete, maximum 5 MB, JPEG/PNG/WebP.
- SECURITY DEFINER RPCs pin `search_path`, validate `auth.uid()`, call `private.can_manage_store`, and are executable by authenticated users only.
- Public SELECT is restricted by RLS to published posts attached to active stores; promotions must be within their validity period.
- Wallet balances are SELECT-only for permitted users; all balance changes occur inside checked database functions.

## Pre-production gates

M05 depends on M03 and M04. It must not be applied to production until:

1. M03 and M04 are tested against a separate non-production database.
2. A restorable production backup/PITR point is created and verified using the organization's approved backup process.
3. The exact target project ref and migration list are captured again.
4. The M05 security and financial test matrix below passes in non-production.
5. The production operator explicitly confirms the approved migration window.

The connected Supabase project currently has no development branches, and the available connector does not create or download a restorable backup. This feature branch deliberately does not apply the migration to production.

## Security and financial test matrix

1. Anonymous users can read published announcements from active stores only.
2. Anonymous users can read published promotions only during their valid date range.
3. Anonymous users cannot read drafts, archived posts, wallet rows, ledger rows or reservation rows.
4. A customer without an authorized store role cannot create, publish or archive posts.
5. A merchant can manage posts only in their own active approved store.
6. Super Admin can manage posts only in the platform-owned SHAKH STORE record, not merchant-owned stores.
7. A promotion cannot reference an unpublished product or a product belonging to another store.
8. Announcement posts cannot carry a product reward, unit count or promotion validity window.
9. Promotion reward and unit count must be positive whole IQD/whole-unit amounts and multiplication must not overflow bigint.
10. Direct client INSERT/UPDATE/DELETE on wallets, wallet ledger, posts or reservation tables is denied.
11. Ledger UPDATE/DELETE is rejected by a database trigger; reversals use compensating entries.
12. Publishing a promotion locks the post and merchant wallet, checks the complete budget and reserves it atomically before changing post status.
13. Two concurrent promotions cannot reserve more than the available wallet balance.
14. Repeated publication does not reserve the same budget twice.
15. Archiving a promotion releases only the remaining reserved budget and writes one immutable release ledger entry.
16. Invalid or oversized images and mismatched MIME/signature pairs are rejected; a failed post insert removes an uploaded image object.
17. Product/post storage paths are restricted to the active store UUID and a random object UUID.

## Known follow-up

The current manager form creates drafts, publishes and archives posts. Draft-edit SQL exists but is not yet surfaced in the manager UI. Expired promotion budget release must be automated or operationally scheduled before production use; until that is implemented and tested, merchants/Super Admin must explicitly archive expired promotions to release remaining budget. Reward settlement and order-level merchant commission remain later phases.

## Validation status

- Feature branch: `feat/m05-posts-promotions`.
- UI and SQL have been statically reviewed; a duplicate TypeScript helper declaration was corrected.
- Promotion `valid_from` is set at publication/reservation time rather than when the draft is first created.
- GitHub Actions CI is required before merging.
- Production M05 migration is not applied. No customer posts, test wallets or demo financial entries have been inserted into production.
