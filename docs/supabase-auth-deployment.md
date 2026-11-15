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

## Resend SMTP configuration

Resend's currently verified sending domain is `shakh.daim-post.online` in region `ap-northeast-1`. Its DKIM TXT and both SPF CNAME records are verified; sending is enabled and receiving is disabled. The previously configured `mail.daim-post.online` sender/key is no longer valid for the current Resend account/domain configuration.

A new domain-restricted, `sending_access` API key has been created specifically for `shakh.daim-post.online`. The token is shown only once to the operator in the ChatGPT conversation. Paste it directly into Supabase SMTP Password. Never commit it to Git or put it in a `NEXT_PUBLIC_*` variable.

In Supabase Dashboard → Authentication → SMTP Settings, enable Custom SMTP and replace the old sender settings with:

| Setting | Value |
| --- | --- |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | The new `SHAKH STORE SMTP - verified shakh domain` sending-only API key |
| Sender email | `no-reply@shakh.daim-post.online` |
| Sender name | `SHAKH STORE` |

Port 465 is the recommended implicit-TLS SMTP endpoint for Resend. Port 587 is an alternative with STARTTLS; do not mix the security mode for these ports. Keep email confirmations enabled; do not enable auto-confirm as a workaround.

## Auth URL configuration

In Supabase Dashboard → Authentication → URL Configuration, use the canonical production host only:

- Site URL: `https://www.daim-post.online`
- Production Redirect URL: `https://www.daim-post.online/auth/callback` (exact path; no trailing `**`)
- Local development Redirect URL: `http://localhost:3000/auth/callback`

Remove old deployment-specific `.vercel.app` redirects from the production allow list. Do not use an individual Vercel deployment URL in production email links. The Vercel custom domains `www.daim-post.online` and `daim-post.online` are verified; the apex domain redirects to `www`.

The previously supplied dashboard screenshot showed `https://www.daim-post.online/auth/callback**`. Replace that entry with the exact production callback above. The app's signup action sends the callback URL as `emailRedirectTo`; its password-recovery action sends the same callback with `next=/reset-password`.

## Auth email templates

In Supabase Dashboard → Authentication → Email Templates:

- **Confirm signup**: the action link must use `{{ .ConfirmationURL }}`.
- **Reset Password**: the action link must use `{{ .ConfirmationURL }}`.
- Do not hardcode a `.vercel.app` URL, an old deployment host, or a manually assembled reset URL.
- Do not construct a password-reset link from `{{ .SiteURL }}` alone. The `ConfirmationURL` generated by Supabase carries the verification token and the redirect destination supplied by the app.

Safe Reset Password template action:

```html
<h2>Reset your password</h2>
<p>We received a request to reset your password.</p>
<p><a href="{{ .ConfirmationURL }}">Reset password</a></p>
<p>If you did not request this, you can ignore this email.</p>
```

Safe Confirm Signup template action:

```html
<h2>Confirm your email address</h2>
<p><a href="{{ .ConfirmationURL }}">Confirm email address</a></p>
```

The app's `/auth/callback` route exchanges the PKCE authorization code for a cookie-backed session. For password recovery it then routes the user to `/reset-password`. The reset page updates the password only after a valid authenticated recovery session is present.

## Domain and email delivery state (2026-11-15)

- Vercel production domains `www.daim-post.online` and `daim-post.online`: verified; apex redirects to `www`.
- Resend's current domain `shakh.daim-post.online`: fully verified; sending enabled; receiving disabled. DKIM TXT and both SPF CNAME records are verified.
- A previous password-recovery email was delivered on 2026-11-15 at 11:01:18 UTC using the former `mail.daim-post.online` configuration. That test is not proof the current configuration is valid.
- A later password-recovery request on 2026-11-15 at 12:01:47 UTC failed with SMTP 550: `The associated domain with your API key is not verified`. This identified a sender/API-key mismatch: Supabase was still using `no-reply@mail.daim-post.online` and an API key scoped to the former domain, while the active verified Resend domain is `shakh.daim-post.online`.
- A replacement Resend key with `sending_access` permission restricted to `shakh.daim-post.online` has now been created. The operator must paste that one-time token into Supabase SMTP Password and change Sender email to `no-reply@shakh.daim-post.online`. This credential has not been installed into Supabase by the automation.
- After saving the new SMTP password/sender, request a fresh password recovery email and verify its Resend status is `delivered`; then click that newest link once, confirm it reaches `/reset-password`, update the password, sign out and sign in with the new password.
- SMTP credentials must remain in Supabase's private SMTP settings. Never store the Resend API key in GitHub, in a `NEXT_PUBLIC_*` variable, or in client-side code.

## End-to-end verification checklist

1. Create a new test account from `https://www.daim-post.online/signup` using an inbox you control.
2. Confirm the signup email. Its link must finish on `www.daim-post.online`, not an individual `.vercel.app` deployment.
3. Verify that the new Auth user has exactly one `profiles` row and the default `customer` role. Do not promote a test account to Super Admin.
4. Request a password reset from `https://www.daim-post.online/forgot-password`.
5. In Resend, confirm the fresh message's status is delivered (not just accepted or queued); inspect bounce/failed status if it is not delivered.
6. Open the newest reset email. It must route through `https://www.daim-post.online/auth/callback` and then reach `/reset-password`.
7. Set a new password, sign out, and sign in using the new password. Confirm the old password no longer works.
8. Repeat in a second browser/private session to catch cookie and callback issues.

Do not use an old email or previously clicked recovery link for the verification run; Supabase links are one-time and expire. Keep email confirmations enabled and never use auto-confirm as a workaround.

## Verification checklist

- Signup creates exactly one `profiles` row and one `customer` role.
- A user cannot INSERT, UPDATE or DELETE rows in `user_roles` through the client Data API.
- A user cannot read another user's profile or role assignments.
- A non-admin cannot access Super Admin pages.
- A Super Admin can read profiles and role assignments.
- Editing `user_metadata` cannot grant an application role.
- Auth callback and password recovery routes work with the configured redirect URLs.
- Supabase Security and Health Advisors return no findings. Performance Advisor reports only unused-index notices while the new tables have no production traffic; the missing foreign-key index finding has been resolved.
