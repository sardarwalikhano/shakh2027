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
- Role dashboard routes exist for Super Admin, merchants, captains and customers.
- PWA manifest, service-worker registration, static-asset caching and an offline fallback are included. Authenticated pages and API responses are excluded from service-worker caching.
- GitHub Actions runs TypeScript checks, ESLint and a production build. Vercel production deployment and custom domains are configured and verified.

### Current delivery phase

- M00 project foundation and M01 Identity/Auth foundations are deployed.
- M02 shared role-aware dashboard navigation is being completed on branch `feat/m02-role-aware-dashboard-navigation`. The shared shell displays database-authorized links for Super Admin, merchant, captain and customer roles and replaces duplicate dashboard headers.
- M03 Merchant Store onboarding code has been merged into `main` through PR #1. It adds role-validated merchant applications, the dedicated platform-owned SHAKH STORE row, atomic Super Admin approval/rejection RPCs, review audit events, RLS and the merchant/admin pages.
- The M03 migration is additive but is not yet applied to production. Production DDL is gated on a restorable backup; new pages show a clear setup state until the migration is deployed.
- Product/catalog, inventory, posts/rewards, checkout/orders, captain delivery, wallet/ledger, commission settlement, referrals, top-ups and cashout workflows remain future implementation work. The financial rules in this README are approved requirements, not evidence that those workflows are already live.

## Database status

The active SHAKH STORE Supabase project is `zuxywfixaawupwgtbugi` in `ap-northeast-1`. The Auth/Roles migration and the assigned-by index migration are applied. The current public application schema contains:

- `profiles`
- `user_roles`

Both tables have RLS enabled. The current target project is separate from the legacy Supabase project `ewulzprizvbgypzaogez`; that legacy project and its data must remain untouched.

The M03 migration file `supabase/migrations/202611150003_merchant_stores.sql` is additive and includes `stores`, `store_review_events`, merchant store submission and Super Admin review functions, RLS policies, indexes, and the single platform-owned SHAKH STORE row. It must not be applied to production until a restorable backup is confirmed and the migration is reviewed. The available Supabase connector does not create or download a restorable database backup, so production DDL remains pending rather than claiming a backup exists.

The previous `docs/database-audit.md` is a historical read-only audit of the legacy project, not a description of the active SHAKH STORE target. Do not run its old-project findings as SQL against the new target.

### Security and operational notes

- Supabase Security Advisor currently reports leaked-password protection disabled. Enable it in Supabase Auth password security before launch.
- Supabase Performance Advisor currently reports only unused indexes on the low-traffic role tables; no current Health Advisor findings were returned.
- The existing Auth/Roles migrations must remain unchanged. Future schema changes must be additive, backed up, reviewed and independently verified.
- No mock, demo or seed marketplace content may be inserted. The one platform-owned SHAKH STORE row in M03 is required operational configuration, not demo content.
- Financial changes must be database-side, atomic, idempotent and ledger-backed. Do not ship frontend balance edits or unapproved percentage splits.

## Production integration

- GitHub repository: `sardarwalikhano/shakh2027`, branch `main`. M03 code is merged; M02 shared navigation is in progress.
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
