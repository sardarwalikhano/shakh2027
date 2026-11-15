# M03 — Merchant store onboarding deployment plan

## Scope

This phase introduces merchant store applications and the Super Admin review queue. It does not yet implement products, inventory, checkout, posts, wallet, order processing or delivery.

### Added application files

- `app/dashboard/merchant/store/page.tsx`: merchant store application and status page.
- `app/dashboard/merchant/store/actions.ts`: authenticated server action for submitting applications.
- `app/dashboard/admin/stores/page.tsx`: pending store review queue.
- `app/dashboard/admin/stores/actions.ts`: Super Admin-only approve/reject server action.
- `lib/domain/stores.ts`: role-to-store-type mapping and slug validation.
- Shared Sorani, Arabic and English messages and responsive styles.

### Database migration

`supabase/migrations/202611150003_merchant_stores.sql` is additive. It does not alter the existing `profiles` or `user_roles` tables and does not modify either earlier migration.

It creates:

- `public.stores` with merchant ownership, category, slug, contact/location fields and review status.
- `public.store_review_events` as an append-only history of Super Admin decisions.
- `public.submit_merchant_store(...)`, which checks `auth.uid()` and the matching database role before creating a pending application.
- `public.review_merchant_store(...)`, which checks Super Admin in the database, locks the pending application, changes status and writes the review event in one transaction.
- RLS policies for public visibility of active stores, owner visibility of their own application, and Super Admin visibility.
- One operational, platform-owned `SHAKH STORE` store row with `owner_id = NULL`. This row is required for the approved platform catalog model; it is not demo content.

Direct client INSERT/UPDATE/DELETE grants are not provided on either new table. Writes go through authenticated security-definer RPCs with explicit authorization checks.

## Production preflight and backup gate

**Do not apply this migration to production until a restorable backup has been created and verified.**

Current target project ref: `zuxywfixaawupwgtbugi`.

Before applying:

1. Confirm the project ref and region in Supabase Dashboard.
2. Create a restorable database backup/export using the organization's approved Supabase backup/PITR or database-export process. The GitHub repository and SQL migration file are not a database backup.
3. Confirm that the backup can be restored, or that the available PITR restore point is usable.
4. Capture the current migration list and current `profiles` / `user_roles` row counts.
5. Run the migration in a non-production database first, including the security test matrix below.
6. Apply the migration only after the restore point and test results are accepted.

The connected Supabase toolset available for this project can inspect schema, run SQL and apply migrations, but it does not expose a create/download-restorable-backup operation. Therefore this repository change deliberately does not apply the M03 migration to production.

## Apply procedure

After the backup gate is satisfied:

1. Confirm `202611150001_auth_roles` and `202611150002_user_roles_assigned_by_index` remain present.
2. Review the exact SQL in `supabase/migrations/202611150003_merchant_stores.sql`.
3. Apply it to project ref `zuxywfixaawupwgtbugi` with Supabase migration tooling.
4. Verify `stores` and `store_review_events` both have RLS enabled.
5. Verify the single `shakh-store` platform row exists with `store_type='shakh_store'`, `owner_id IS NULL`, and `status='active'`.
6. Verify the RPC grants: authenticated can execute the two RPCs; anon cannot. Authenticated clients have SELECT only on the tables and no direct table write grants.
7. Run the security test matrix below before enabling merchant onboarding in production.

## Security test matrix

1. Anonymous users can read active stores only; they cannot read pending/rejected applications.
2. A signed-in customer without a merchant role cannot execute `submit_merchant_store`.
3. A restaurant role can submit only a `restaurant` store.
4. A supermarket, meat/seafood or baqal role can submit only its matching store type.
5. A merchant cannot submit `shakh_store` or set a store to active.
6. A merchant can read their own pending or rejected application; another merchant cannot.
7. Only a Super Admin can execute `review_merchant_store`.
8. A review of a pending application changes status and writes one review event atomically.
9. A second active/pending application for the same owner and store type is rejected.
10. After rejection, a new application may be submitted; it must use a unique slug.
11. The platform-owned SHAKH STORE row cannot be duplicated by the merchant RPC.
12. No client path can INSERT, UPDATE or DELETE store or review-event rows directly.

## Rollback plan

The migration is additive. Do not modify or roll back the two Auth/Roles migrations.

If M03 has not yet accepted real merchant data, and the exact M03 migration is the only migration after the backup point, the following transaction removes only M03 objects and its platform seed row:

```sql
begin;

drop function if exists public.review_merchant_store(uuid, text, text);
drop function if exists public.submit_merchant_store(text, text, text, text, text, text, text, text, text);

drop table if exists public.store_review_events;

delete from public.stores
where store_type = 'shakh_store'
  and owner_id is null
  and slug = 'shakh-store';

drop table if exists public.stores;

commit;
```

Do not run this rollback after real merchant applications, reviews or store records have been accepted. In that case, preserve/export the M03 data and prefer a forward-fix migration. Dropping a table with user data is destructive even when the migration is additive.

## Known follow-up work

After M03 is deployed and verified, continue with the next approved phase: category/catalog and product records, image storage, inventory and merchant publishing permissions. Those modules must build on the approved store ownership boundary and must not add mock production data.
