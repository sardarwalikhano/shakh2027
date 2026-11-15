-- SHAKH STORE: authentication profiles and database-backed roles.
-- Apply only to the dedicated SHAKH STORE Supabase project after verifying its project ref
-- and taking a recoverable backup. This migration does not touch any legacy project.

create type public.app_role as enum (
  'super_admin',
  'restaurant',
  'supermarket',
  'meat_seafood_vendor',
  'baqal',
  'captain',
  'customer'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  locale text not null default 'ku',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_length check (full_name is null or char_length(full_name) between 1 and 120),
  constraint profiles_phone_length check (phone is null or char_length(phone) <= 32),
  constraint profiles_locale_allowed check (locale in ('ku', 'ar', 'en'))
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint user_roles_user_role_unique unique (user_id, role)
);

create index user_roles_user_id_idx on public.user_roles(user_id);
create index user_roles_role_idx on public.user_roles(role);

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = 'super_admin'::public.app_role
  );
$$;

create or replace function public.has_role(role_to_check public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = role_to_check
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- This trigger is the only normal signup path that creates a default role.
-- User-editable metadata is used only for the display name, never for authorization.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  supplied_name text;
begin
  supplied_name := nullif(btrim(new.raw_user_meta_data ->> 'full_name'), '');

  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(supplied_name, nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'SHAKH customer')
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'customer'::public.app_role)
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

create policy "profiles_select_own_or_admin"
on public.profiles
for select
to authenticated
using (id = (select auth.uid()) or (select public.is_super_admin()));

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "user_roles_select_own_or_admin"
on public.user_roles
for select
to authenticated
using (user_id = (select auth.uid()) or (select public.is_super_admin()));

-- No direct INSERT/UPDATE/DELETE policy is created for user_roles.
-- Role assignment is an administrative database operation, not a client-side action.

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.user_roles from anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (full_name, phone, avatar_url, locale) on table public.profiles to authenticated;
grant select on table public.user_roles to authenticated;

revoke all on function public.is_super_admin() from public, anon;
revoke all on function public.has_role(public.app_role) from public, anon;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.has_role(public.app_role) to authenticated;

comment on table public.profiles is
  'Public profile attributes only. Authentication credentials remain in Supabase Auth.';
comment on table public.user_roles is
  'Authoritative application roles. Never populate authorization from user-editable user_metadata.';
comment on function public.handle_new_auth_user() is
  'Creates a profile and customer role for each new Auth user. Elevated roles require a trusted admin operation.';
