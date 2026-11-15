# SHAKH STORE — Supabase Auth & Roles deployment runbook

## Target project

- Project ref: `zuxywfixaawupwgtbugi`
- API URL: `https://zuxywfixaawupwgtbugi.supabase.co`
- Vercel production site: `https://www.daim-post.online`

Preflight on 2026-11-15 confirmed: 0 public tables, 0 recorded migrations, 0 Auth users and 0 Storage buckets. This gives a clean starting point; it is not a substitute for maintaining backups after production data begins to accumulate.

## What migration 202611150001_auth_roles.sql creates

- `profiles`: safe profile attributes linked to `auth.users`.
- `user_roles`: authoritative application roles.
- A private Auth trigger that creates a profile and assigns only the default `customer` role after signup.
- RLS policies: a user can read and update their own profile and read their own roles; a Super Admin can read these records.
- Direct role INSERT/UPDATE/DELETE privileges are not granted to client roles.
- Security-definer helper and trigger functions live in the non-exposed `private` schema, pin `search_path`, and have restricted execute privileges.

This migration does not yet create merchant, captain, store, product, order, commission, wallet, reward, referral or top-up tables.

## Environment variables

The current Vercel project `shakh2027` uses these variables:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://zuxywfixaawupwgtbugi.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<SUPABASE_PUBLISHABLE_KEY>
NEXT_PUBLIC_SITE_URL=https://www.daim-post.online
```

Use the modern `sb_publishable_...` key. The legacy `anon` key is public-compatible, but is not needed in this project. Never put a Supabase secret or `service_role` key into a `NEXT_PUBLIC_*` variable.

## Apply migration

The migrations `supabase/migrations/202611150001_auth_roles.sql` and `supabase/migrations/202611150002_user_roles_assigned_by_index.sql` have both been applied to the verified project ref `zuxywfixaawupwgtbugi`.

For CLI-based deployment from a trusted machine:

```bash
supabase login
supabase link --project-ref zuxywfixaawupwgtbugi
supabase migration list
supabase db push
```

Do not link or push to any legacy project.

## Bootstrap the first Super Admin

First create the intended administrator through the regular signup page and verify the email. Then verify the Auth user ID in Supabase Dashboard and execute this one-time SQL in the target project's SQL Editor:

```sql
insert into public.user_roles (user_id, role)
values ('<VERIFIED_AUTH_USER_UUID>', 'super_admin')
on conflict (user_id, role) do nothing;
```

Do not accept an ID supplied by a browser form as proof of identity. The first elevated role is granted only by a trusted database administrator.

## Auth configuration

In Supabase Dashboard → Authentication → URL Configuration:

- Site URL: `https://www.daim-post.online`
- Redirect URL: `https://www.daim-post.online/auth/callback`
- Local development redirect: `http://localhost:3000/auth/callback`

The Vercel custom domains `www.daim-post.online` and `daim-post.online` are verified. The apex domain redirects to `www`. In Supabase Authentication → URL Configuration, set Site URL to `https://www.daim-post.online` and add `https://www.daim-post.online/auth/callback` plus `https://www.daim-post.online/**` (or explicit required paths) to the redirect allow list.

Configure a verified SMTP sender identity before relying on production confirmation and password recovery email delivery.

## Verification checklist

- Signup creates exactly one `profiles` row and one `customer` role.
- A user cannot INSERT, UPDATE or DELETE rows in `user_roles` through the client Data API.
- A user cannot read another user's profile or role assignments.
- A non-admin cannot access Super Admin pages.
- A Super Admin can read profiles and role assignments.
- Editing `user_metadata` cannot grant an application role.
- Auth callback and password recovery routes work with the configured redirect URLs.
- Supabase Security and Health Advisors return no findings. Performance Advisor reports only unused-index notices while the new tables have no production traffic; the missing foreign-key index finding has been resolved.
