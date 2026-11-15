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

A separate Supabase project was created by the user and its URL was supplied: `https://hzekyhcihhddehxndfyg.supabase.co` (ref `hzekyhcihhddehxndfyg`). The project is not yet visible to the currently connected Supabase MCP identity: `list_projects` only returns the legacy `ewulzprizvbgypzaogez` project, and direct project inspection returned a permission error. Connect/authorize the new project in the Supabase integration before applying any migrations.

`.env.example` points to the new project URL, but its publishable key is intentionally blank. Do not use the legacy project's key. Add the new project's publishable key to local and Vercel environment variables only after access is granted.

Known blockers from the initial read-only audit:

- The current cashout routine hardcodes a 75% customer payout / 25% platform fee. This split was not approved in the SHAKH STORE blueprint and must not be treated as a business rule.
- Several SECURITY DEFINER routines accept caller-supplied user IDs; their authorization boundaries need review.
- The cashout routine is executable by authenticated users and needs privilege review.
- One table has RLS enabled without policies.
- Existing database rows must be preserved. Do not reset, truncate, or replace the schema.
- No migration should be applied until a verified backup/export and a reconciled, reviewed migration plan exist.


- The first database migration is checked into `supabase/migrations/202611150001_auth_roles.sql`, with a deployment and Super Admin bootstrap runbook at `docs/supabase-auth-deployment.md`. It is a reviewed source artifact only and has not been applied to a Supabase project.

## Current integration status — 2026-11-15

- Vercel project `shakh2027` now exists and its deployment metadata identifies the GitHub source as `sardarwalikhano/shakh2027`, branch `main`. The initial production deployment was still in `BUILDING` state at the last inspection.
- The Vercel project currently has no visible project environment variables, and only its generated `*.vercel.app` domain is attached. The custom domain `daim-post.online` has not been attached or verified.
- The connected Supabase integration now exposes a different project, ref `zuxywfixaawupwgtbugi`, with zero public tables and zero migration records. This ref does not match the explicitly supplied project URL ref `hzekyhcihhddehxndfyg`. It must not be treated as the target until the project owner confirms it.
- No Supabase migration has been executed. The legacy database remains untouched.

## Development constraints

- No demo, mock, or seed data in production.
- Financial changes must be server-side, atomic, idempotent and ledger-backed.
- Never authorize from user-editable user_metadata.
- Every exposed table must have intentional RLS policies.
- Super Admin authorization must be checked server-side and at the database boundary.
- Financial ledger history is immutable; use compensating entries for reversals.
