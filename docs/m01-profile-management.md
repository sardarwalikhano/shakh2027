# M01/M02 — Shared profile management

## Scope

The authenticated dashboard now includes a profile link for every signed-in role. The profile page allows the account owner to view their email and roles, and update only:

- Full name (2–120 characters).
- Optional phone number (7–32 characters; digits and common phone punctuation).

The authentication email is read-only in this workflow. Changing an email address requires a separate Supabase Auth email-change flow with confirmation and is intentionally not implemented here.

## Security boundary

- Page access requires a verified Supabase session from `auth.getClaims()`.
- The server action calls `requireAuthContext()`; it does not trust a submitted user ID.
- The action updates only `full_name` and `phone`, with the row predicate fixed to the authenticated user ID from the server context.
- PostgreSQL RLS policy `profiles_update_own` and column-level grants remain authoritative.
- No service-role key, client-supplied user ID, role update, email update, avatar URL or locale update is accepted by this form.
- Application roles are displayed from `public.user_roles`; they are not editable from the profile page.
- No schema migration is required because the Auth/Roles migration already defines the allowed profile columns and own-row RLS.

## Verification checklist

1. Sign in with each role and confirm the shared navigation contains My Profile.
2. Load `/dashboard/profile` and verify it shows only the current user's email, roles and profile fields.
3. Update full name and phone, then confirm the changes persist after refresh.
4. Leave phone blank and confirm the optional value stores NULL.
5. Submit a too-short name, malformed phone, or overlength value and confirm validation rejects it.
6. Attempt to tamper with the form payload by changing a user ID; there is no user ID input and the server action uses the session identity.
7. Attempt direct profile update for another user's UUID using the authenticated Data API; RLS must reject it.
8. Attempt to change role, email, or other profile columns through the form; no such fields/actions are exposed.
9. Verify the profile link is visible to Super Admin, restaurant, supermarket, meat/seafood, baqal, captain and customer roles.
10. Verify Sorani, Arabic and English messages and RTL/LTR direction.

## Status

Profile UI and server action are implemented on `feat/m01-profile-management`. The feature uses the already deployed `profiles` table, existing RLS and column grants; it adds no production DDL.
