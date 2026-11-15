# SHAKH STORE — Supabase Auth & Roles deployment runbook

## Scope

This runbook deploys the first database migration for the standalone SHAKH STORE application:

- `profiles`: safe profile attributes linked to `auth.users`.
- `user_roles`: authoritative database-backed roles.
- New Auth signup trigger: creates a profile and assigns only the default `customer` role.
- RLS policies: users can read their own profile and roles; Super Admin can read them globally.
- Users can update only the permitted profile columns. Clients cannot insert, update, or delete role assignments.

No merchant, captain, product, order, commission, wallet, reward, or referral tables are created by this first migration. Those belong in later reviewed migrations.

## Critical project identity check

The application currently contains the explicitly supplied URL:

`https://hzekyhcihhddehxndfyg.supabase.co`

The connected Supabase integration did not expose that project. A different project, ref `zuxywfixaawupwgtbugi`, is visible and currently reports zero public tables and zero migrations. Do not assume those refs are interchangeable. Do not apply this migration to either project until the project owner confirms the exact target ref and the repository environment is aligned with it.

The legacy project `ewulzprizvbgypzaogez` is not the target and must not be modified.

## Pre-deployment checks

1. Confirm the target project ref in Supabase Dashboard → Project Settings → General.
2. Confirm that the ref matches `NEXT_PUBLIC_SUPABASE_URL` in the deployment environment.
3. Export a database backup and confirm that it can be downloaded and restored to a separate recovery project.
4. Confirm the migration has not already been applied.
5. Review the SQL migration in `supabase/migrations` before execution.

## Apply migration

Use Supabase CLI from a trusted local environment linked to the verified target project:

```bash
supabase login
supabase link --project-ref <VERIFIED_PROJECT_REF>
supabase migration list
supabase db push
```

Do not substitute the legacy project ref. Do not use a service-role key in browser code or a `NEXT_PUBLIC_*` variable.

## Bootstrap the first Super Admin

The migration intentionally does not guess which account should be Super Admin. First create the intended administrator account using the normal signup flow and complete email verification. Then, in the SQL Editor of the verified target project, run this one-time privileged statement after replacing the UUID with the verified Auth user ID:

```sql
insert into public.user_roles (user_id, role)
values ('<VERIFIED_AUTH_USER_UUID>', 'super_admin')
on conflict (user_id, role) do nothing;
```

Do not accept a user ID supplied by a browser form as proof of identity. Verify the Auth user in Supabase Dashboard before granting this role.

## Auth configuration

In Supabase Dashboard → Authentication → URL Configuration:

- Site URL: `https://daim-post.online` after domain ownership and deployment are confirmed.
- Redirect URL: `https://daim-post.online/auth/callback`.
- Local development redirect: `http://localhost:3000/auth/callback`.

Configure email SMTP and sender identity only with a verified sending domain. Do not use a sender address on an unverified domain.

## Required environment variables

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<VERIFIED_PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<PROJECT_PUBLISHABLE_KEY>
NEXT_PUBLIC_SITE_URL=https://daim-post.online
```

Only the publishable/anon key belongs in client-visible variables. Keep any Supabase secret or service-role key server-only; this app's current Auth flow does not require one.

## Post-deployment verification

- A new signup creates exactly one `profiles` row and one `customer` role.
- A user cannot insert or update rows in `user_roles` through the client API.
- A user cannot read another user's profile or role assignments.
- A non-admin cannot access Super Admin pages.
- A Super Admin can read profiles and roles.
- Editing `user_metadata` cannot grant any application role.
- Auth callback and password recovery redirects resolve only to the expected application origin and local paths.

Run the Supabase Security and Performance Advisors after the migration. Do not proceed to financial tables or wallet RPCs until these checks pass.
