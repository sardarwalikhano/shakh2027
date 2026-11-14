# SHAKH STORE

Production application for the SHAKH STORE marketplace in Iraq.

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

## Database status — audit required before schema writes

The connected Supabase project currently contains 11 public tables and data in several tables. It has no recorded migration history. Existing schema and routines are not yet aligned with the approved Database Blueprint.

Known blockers from the initial read-only audit:

- The current cashout routine hardcodes a 75% customer payout / 25% platform fee. This split was not approved in the SHAKH STORE blueprint and must not be treated as a business rule.
- Several SECURITY DEFINER routines accept caller-supplied user IDs; their authorization boundaries need review.
- The cashout routine is executable by authenticated users and needs privilege review.
- One table has RLS enabled without policies.
- Existing database rows must be preserved. Do not reset, truncate, or replace the schema.
- No migration should be applied until a verified backup/export and a reconciled, reviewed migration plan exist.

## Development constraints

- No demo, mock, or seed data in production.
- Financial changes must be server-side, atomic, idempotent and ledger-backed.
- Never authorize from user-editable user_metadata.
- Every exposed table must have intentional RLS policies.
- Super Admin authorization must be checked server-side and at the database boundary.
- Financial ledger history is immutable; use compensating entries for reversals.
