# M04 — Product catalog and merchant publishing

## Scope

M04 adds the first operational catalog workflow on top of the approved M03 store ownership boundary:

- Create, read, update and archive product records.
- Upload a product cover image to the public `product-images` bucket.
- Store all prices as whole IQD amounts; no floating-point or foreign-currency price is accepted.
- Browse published products from active stores at `/catalog`.
- Manage products from the authenticated shared dashboard at `/dashboard/products`.

M04 does not implement inventory reservations, carts, checkout, order processing, promotion/reward posts, wallet or commission accounting. Those remain later phases.

## Authorization model

- Super Admin can publish all approved catalog categories only inside the single platform-owned `shakh_store` row with `owner_id IS NULL`.
- Restaurant, supermarket, meat/seafood and baqal accounts can publish only in their own active approved store and only in the category matching their database role.
- The browser does not decide authorization. `private.can_manage_store` and the public RPC functions check the signed-in user and `public.user_roles` in PostgreSQL.
- Clients have SELECT access only on `public.products`; they do not receive direct INSERT, UPDATE or DELETE grants.
- Image uploads are limited to JPEG, PNG and WebP, at most 5 MB. Storage paths are namespaced by the active store UUID. Storage RLS calls the same store-management check.
- Product prices are positive integer IQD values. Stock quantity is optional and non-negative; NULL means no stock quantity was entered. This phase does not reserve or decrement stock on orders.

## Migration dependency and production gate

M04 migration: `supabase/migrations/202611150004_catalog_products.sql`.

It depends on M03 objects and must be applied after `202611150003_merchant_stores.sql`. Apply the sequence only to the active project ref `zuxywfixaawupwgtbugi` after all of the following:

1. A restorable production backup/PITR restore point is created and confirmed through the organization's approved process.
2. M03 is validated in a non-production Supabase database and its security matrix passes.
3. M04 is validated in a non-production Supabase database and its security matrix passes.
4. The target ref, region and current migration list are captured immediately before applying.

The connected Supabase toolset does not expose a restorable backup/export action. No production M03 or M04 migration has been applied. The application shows a setup state if the database migrations are absent. Do not treat a GitHub migration file as a database backup.

## Security verification matrix

1. Anonymous users can SELECT published products only when the parent store is active.
2. Anonymous users cannot SELECT draft or archived products.
3. A customer without a merchant role cannot call `create_store_product`.
4. A restaurant account cannot publish in supermarket, meat/seafood, baqal or platform store categories.
5. A supermarket account cannot publish in another merchant category or another owner's store.
6. A meat/seafood or baqal account is restricted to its corresponding store/category.
7. Super Admin can publish every approved product category only in the platform-owned SHAKH STORE row.
8. Super Admin cannot create a product in a merchant-owned store through the app RPC.
9. A direct authenticated INSERT/UPDATE/DELETE against `public.products` is denied by grants/RLS.
10. An image cannot be uploaded to a store the caller does not manage.
11. Unsupported image MIME types and files over 5 MB are rejected by the application and bucket configuration.
12. Product prices are stored as positive integer IQD amounts; decimal or negative prices are rejected.
13. An update cannot change store ownership and cannot move a merchant product into another category.
14. Archiving hides the product from public catalog reads while preserving the row and image for the store manager.
15. A failed product insert removes the just-uploaded image object to avoid an orphaned file.

## Rollback

M04 is additive and follows M03. Do not run rollback after real catalog products or image objects have been created. Before any production deployment, document a verified restore point and test a forward-fix/restore path in non-production. If the production migration has been applied and there is real data, preserve/export product rows and image objects; do not drop tables or the bucket as a routine rollback.

## Validation status

- Source code and SQL are on branch `feat/m04-product-catalog`.
- TypeScript, ESLint and production build are validated by the GitHub Actions pull-request workflow before merging.
- M03/M04 database migrations are not yet applied or live-tested because no restorable production backup has been confirmed and no billable Supabase development branch has been authorized.
