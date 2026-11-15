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

## Implementation status

- Sorani, Arabic and English landing and authentication flows are implemented with RTL/LTR direction switching.
- Email/password sign-in, sign-up, email callback, password recovery and password update routes are implemented.
- Server-side session validation and role-aware dashboard route guards are implemented against the planned `profiles` and `user_roles` tables.
- Role dashboards exist for Super Admin, merchants, captains and customers.
- PWA manifest, service-worker registration, static-asset caching and an offline fallback are included. Authenticated pages and API responses are explicitly excluded from service-worker caching.
- GitHub Actions validates TypeScript, ESLint and the production build.

The frontend is not yet connected to a newly provisioned production database. Do not treat the role-based dashboard guard as active until the target schema and RLS policies have been deployed.

## Database status — production project pending

The previously inspected Supabase project `ewulzprizvbgypzaogez` is a legacy project and is not the target for this standalone build. It contains 11 public tables and existing data, and has no recorded migration history. It must not be reset or modified for SHAKH STORE.

The dedicated Supabase project is verified and connected: `https://zuxywfixaawupwgtbugi.supabase.co` (ref `zuxywfixaawupwgtbugi`). Preflight on 2026-11-15 confirmed 0 public tables, 0 migrations, 0 Auth users and 0 Storage buckets. The modern publishable key is configured in Vercel; no service-role key is used by the browser.

Known blockers from the initial read-only audit:

- The current cashout routine hardcodes a 75% customer payout / 25% platform fee. This split was not approved in the SHAKH STORE blueprint and must not be treated as a business rule.
- Several SECURITY DEFINER routines accept caller-supplied user IDs; their authorization boundaries need review.
- The cashout routine is executable by authenticated users and needs privilege review.
- One table has RLS enabled without policies.
- Existing database rows must be preserved. Do not reset, truncate, or replace the schema.
- The initial Auth/Roles migration has now been reviewed and deployed to the verified empty target project. Future migrations must be reviewed, backed up and verified before application.


- The first database migration `supabase/migrations/202611150001_auth_roles.sql` has been deployed to the verified target project. Its setup and Super Admin bootstrap procedure is documented at `docs/supabase-auth-deployment.md`.

## Current integration status — 2026-11-15

- Vercel project `shakh2027` now exists and its deployment metadata identifies the GitHub source as `sardarwalikhano/shakh2027`, branch `main`. The initial production deployment was still in `BUILDING` state at the last inspection.
- The Vercel project has the Supabase URL, publishable key and site URL configured for production, preview and development. Only `shakh2027.vercel.app` is attached; the custom domain `daim-post.online` has not been attached or verified.
- Supabase project `zuxywfixaawupwgtbugi` is verified as the target. Its initial Auth/Roles migration has been applied and verified. The legacy database remains untouched.

## Development constraints

- No demo, mock, or seed data in production.
- Financial changes must be server-side, atomic, idempotent and ledger-backed.
- Never authorize from user-editable user_metadata.
- Every exposed table must have intentional RLS policies.
- Super Admin authorization must be checked server-side and at the database boundary.
- Financial ledger history is immutable; use compensating entries for reversals.
