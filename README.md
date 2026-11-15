# SHAKH STORE

Standalone foundation for the SHAKH STORE marketplace in Iraq. The repository is separate from the user's other SHAKH projects.

## Approved product decisions

- Languages: Kurdish Sorani, Arabic, English.
- Currency: IQD.
- UI: RTL for Sorani/Arabic, LTR for English; apricot, white and charcoal design system.
- Roles: Super Admin, Restaurant, Supermarket, Meat & Seafood, Baqal, Captain, Customer.
- Super Admin product ownership is restricted to the dedicated SHAKH STORE platform store.
- Merchant catalog access is restricted to the merchant's own store and category.
- Customer orders are paid in cash.
- Captain delivery commission: 20%, debited from the captain's prepaid internal wallet; captain collects the delivery fee in cash.
- Captain cannot accept new orders when the commission wallet cannot cover the required amount.
- Merchant commission is a fixed per-unit amount agreed before publication.
- Merchant reward budget is reserved before a reward post is published.
- Referral attribution: first valid attribution within 30 days.
- Reward payout is requested by the customer and reviewed/paid externally by Super Admin.
- FastPay and FIB are wallet top-up channels pending official integration and manual verification.

## Stack

- Next.js 16 App Router + TypeScript
- React 19
- Supabase PostgreSQL, Auth, Storage, RLS and Edge Functions
- Vercel deployment target
- PWA foundation

## Local setup

1. Use Node.js 22 or newer.
2. Install dependencies with npm install.
3. Copy .env.example to .env.local.
4. Add the Supabase publishable key from the project's Connect dialog.
5. Run npm run dev.

Never commit .env.local, Supabase secret keys, or service-role keys.

## Implementation status — 2026-11-15

### Completed foundations

- Sorani, Arabic and English landing/authentication flows use RTL for Kurdish and Arabic and LTR for English.
- Email/password signup, sign-in, account confirmation, password recovery and password update are implemented.
- Production password recovery passed an end-to-end test on 2026-11-15: Resend marked the TokenHash email delivered; Supabase verified the token by explicit POST, updated the password and accepted a subsequent sign-in with the new password.
- Auth email templates use a scanner-safe TokenHash confirmation interstitial at `/auth/confirm`. Mail scanners can prefetch the page without consuming the one-time token.
- Server-side session validation and database-backed role checks use `profiles` and `user_roles`; roles are not read from user-editable metadata.
- A shared profile page has been merged into `main`; all signed-in roles can update their own full name and optional phone through own-row RLS. Email and roles remain read-only. The Vercel production deployment for this commit is still building.
- Role dashboard routes exist for Super Admin, merchants, captains and customers. A shared profile page lets every signed-in user update their own name and phone through the RLS-protected profile row; email is read-only in this flow.
- PWA manifest, service-worker registration, static-asset caching and an offline fallback are included. Authenticated pages and API responses are excluded from service-worker caching.
- GitHub Actions runs TypeScript checks, ESLint and a production build. Vercel production deployment and custom domains are configured and verified.

### Current delivery phase

- M00 project foundation and M01 Identity/Auth foundations are deployed.
- M02 shared role-aware dashboard navigation is merged into `main` and deployed to Vercel. The shared shell displays database-authorized links for Super Admin, merchants, captains and customers.
- M05 posts/promotions implementation is on `feat/m05-posts-promotions`; its duplicate helper declaration and image MIME narrowing issue were fixed. Type check, lint and production build passed in GitHub Actions. The public posts feed and three-locale links are on the feature branch. Draft PR #5 remains unmerged; M03/M04/M05 production migrations are pending backup and non-production validation.
- M06 cart and COD checkout implementation is on `feat/m06-customer-cart-checkout`, based on M05. It includes an atomic multi-store checkout RPC, per-store COD orders and delivery fees, inventory locking/decrement, order history and early-stage customer cancellation. GitHub CI and SQL validation are pending; M06 production DDL is not applied.
- M03 Merchant Store onboarding code is merged into `main` through PR #1. It adds role-validated merchant applications, the dedicated platform-owned SHAKH STORE row, atomic Super Admin approval/rejection RPCs, review audit events, RLS and the merchant/admin pages.
- The M03 migration is additive but is not yet applied to production. Production DDL is gated on a restorable backup and a non-production security test.
- M04 Product Catalog code has been merged into `main` through PR #3. It adds IQD-priced products, role/store/category checks, validated product image uploads, merchant/admin catalog management and a public catalog. Its migration depends on M03 and is not applied to production. The UI displays a setup state until M03/M04 database migrations are safely deployed.
- M05 posts and promotions code is being validated on `feat/m05-posts-promotions`. It includes merchant/Super Admin post management, a public published-post feed, zero-balance merchant wallet provisioning, immutable ledger schema and atomic promotion-budget reservation/release RPCs. It has not been merged or deployed; its SQL migration is not applied.
- M06 customer cart and COD checkout code is being validated on `feat/m06-customer-cart-checkout`. It includes a browser-persisted cart, multi-store single checkout that creates one order per store atomically, database-side price/stock verification, Super Admin delivery-fee configuration, customer order history and cancellation of unpaid placed orders. Its SQL migration is not applied to production.
- Wallet top-ups, reward settlement after delivered orders, later order lifecycle transitions, separate order-level merchant commission settlement, captain assignment/delivery, captain wallet operations, referrals and cashout remain later implementation phases. The financial rules in this README are approved requirements, not evidence that those workflows are already live.

## Database status

The active SHAKH STORE Supabase project is `zuxywfixaawupwgtbugi` in `ap-northeast-1`. The Auth/Roles migration and the assigned-by index migration are applied. The current public application schema contains:

- `profiles`
- `user_roles`

Both tables have RLS enabled. The current target project is separate from the legacy Supabase project `ewulzprizvbgypzaogez`; that legacy project and its data must remain untouched.

The M03 migration file `supabase/migrations/202611150003_merchant_stores.sql` is additive and includes `stores`, `store_review_events`, merchant store submission and Super Admin review functions, RLS policies, indexes, and the single platform-owned SHAKH STORE row.

The M04 migration file `supabase/migrations/202611150004_catalog_products.sql` depends on M03 and adds IQD-priced products, store/category-aware catalog RPCs, product-image Storage bucket and policies, and public product reads. Neither M03 nor M04 is applied to production. The available Supabase connector does not create or download a restorable database backup, so production DDL remains pending until a backup/restore point and non-production migration tests are confirmed.

The previous `docs/database-audit.md` is a historical read-only audit of the legacy project, not a description of the active SHAKH STORE target. Do not run its old-project findings as SQL against the new target.

### Security and operational notes

- Supabase Security Advisor currently reports leaked-password protection disabled. Enable it in Supabase Auth password security before launch.
- Supabase Performance Advisor currently reports only unused indexes on the low-traffic role tables; no current Health Advisor findings were returned.
- The existing Auth/Roles migrations must remain unchanged. Future schema changes must be additive, backed up, reviewed and independently verified.
- No mock, demo or seed marketplace content may be inserted. The one platform-owned SHAKH STORE row in M03 is required operational configuration, not demo content.
- Financial changes must be database-side, atomic, idempotent and ledger-backed. Do not ship frontend balance edits or unapproved percentage splits.

## Production integration

- GitHub repository: `sardarwalikhano/shakh2027`, branch `main`. M01 profile management, M02 navigation, M03 store onboarding and M04 catalog application code are merged. The latest profile deployment is being built; M03/M04 production database migrations remain gated on backup and non-production validation.
- Vercel project: `shakh2027`.
- Canonical production URL: `https://www.daim-post.online`; `https://daim-post.online` redirects to `www`.
- Vercel project environment variables include the Supabase URL, publishable key and canonical site URL for production, preview and development.
- Resend verified sender domain: `shakh.daim-post.online`. DKIM and both SPF CNAME records are verified; sending is enabled. Supabase custom SMTP was updated to a sending-only key restricted to that verified domain.

## Development constraints

- No demo, mock, or seed data in production.
- Financial changes must be server-side, atomic, idempotent and ledger-backed.
- Never authorize from user-editable user_metadata.
- Every exposed table must have intentional RLS policies.
- Super Admin authorization must be checked server-side and at the database boundary.
- Financial ledger history is immutable; use compensating entries for reversals.
