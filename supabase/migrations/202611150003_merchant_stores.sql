-- SHAKH STORE M03: merchant store applications and platform-owned store.
-- Additive only. Does not alter or delete profiles/user_roles or prior migrations.
-- Apply only after a restorable production backup and preflight review.

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete restrict,
  store_type text not null,
  name text not null,
  slug text not null,
  description text,
  phone text,
  contact_email text,
  country text not null default 'Iraq',
  governorate text,
  district text,
  address_line text,
  status text not null default 'pending',
  review_note text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint stores_type_allowed check (
    store_type in ('shakh_store', 'restaurant', 'supermarket', 'meat_seafood', 'baqal')
  ),
  constraint stores_name_length check (char_length(btrim(name)) between 2 and 120),
  constraint stores_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 80),
  constraint stores_description_length check (description is null or char_length(description) <= 1500),
  constraint stores_phone_length check (phone is null or char_length(phone) <= 32),
  constraint stores_contact_email_length check (contact_email is null or char_length(contact_email) <= 254),
  constraint stores_governorate_length check (governorate is null or char_length(governorate) <= 100),
  constraint stores_district_length check (district is null or char_length(district) <= 100),
  constraint stores_address_length check (address_line is null or char_length(address_line) <= 300),
  constraint stores_status_allowed check (status in ('pending', 'active', 'rejected', 'suspended')),
  constraint stores_platform_owner_guard check (
    (store_type = 'shakh_store' and owner_id is null and status = 'active')
    or
    (store_type <> 'shakh_store' and owner_id is not null)
  ),
  constraint stores_approval_metadata_guard check (
    (status = 'active' and store_type = 'shakh_store')
    or
    (status <> 'active' and store_type <> 'shakh_store')
    or
    (status = 'active' and approved_by is not null and approved_at is not null)
  )
);

create unique index stores_slug_uidx on public.stores (slug);
create unique index stores_one_platform_store_uidx
  on public.stores (store_type)
  where store_type = 'shakh_store';
create unique index stores_owner_store_type_uidx
  on public.stores (owner_id, store_type)
  where owner_id is not null and status <> 'rejected';
create index stores_status_created_at_idx
  on public.stores (status, created_at desc);
create index stores_store_type_status_idx
  on public.stores (store_type, status);

create trigger stores_set_updated_at
before update on public.stores
for each row execute function private.set_updated_at();

alter table public.stores enable row level security;

create policy stores_public_read_active
on public.stores
for select
to anon
using (status = 'active');

create policy stores_authenticated_read
on public.stores
for select
to authenticated
using (
  status = 'active'
  or owner_id = (select auth.uid())
  or (select private.is_super_admin())
);

revoke all on table public.stores from anon, authenticated;
grant select on table public.stores to anon, authenticated;

create table public.store_review_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  reviewed_by uuid not null references auth.users(id) on delete restrict,
  decision text not null check (decision in ('approved', 'rejected')),
  note text,
  created_at timestamptz not null default now(),
  constraint store_review_events_note_length check (note is null or char_length(note) <= 1000)
);

create index store_review_events_store_created_idx
  on public.store_review_events (store_id, created_at desc);
create index store_review_events_reviewed_by_idx
  on public.store_review_events (reviewed_by, created_at desc);

alter table public.store_review_events enable row level security;

create policy store_review_events_owner_or_admin_read
on public.store_review_events
for select
to authenticated
using (
  (select private.is_super_admin())
  or exists (
    select 1
    from public.stores s
    where s.id = store_id
      and s.owner_id = (select auth.uid())
  )
);

revoke all on table public.store_review_events from anon, authenticated;
grant select on table public.store_review_events to authenticated;

-- Each merchant may submit one store application for each assigned merchant role.
-- Client-side role selection is not trusted; the role/type pairing is checked here.
create or replace function public.submit_merchant_store(
  p_store_type text,
  p_name text,
  p_slug text default null,
  p_description text default null,
  p_phone text default null,
  p_contact_email text default null,
  p_governorate text default null,
  p_district text default null,
  p_address_line text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_required_role public.app_role;
  v_slug text;
  v_store_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.'
      using errcode = '28000';
  end if;

  v_required_role := case p_store_type
    when 'restaurant' then 'restaurant'::public.app_role
    when 'supermarket' then 'supermarket'::public.app_role
    when 'meat_seafood' then 'meat_seafood_vendor'::public.app_role
    when 'baqal' then 'baqal'::public.app_role
    else null
  end;

  if v_required_role is null then
    raise exception 'This store type cannot be submitted by a merchant.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_user_id
      and ur.role = v_required_role
  ) then
    raise exception 'The account does not have the required merchant role.'
      using errcode = '42501';
  end if;

  if p_name is null or char_length(btrim(p_name)) not between 2 and 120 then
    raise exception 'Store name must contain between 2 and 120 characters.'
      using errcode = '22023';
  end if;

  if p_governorate is null or char_length(btrim(p_governorate)) not between 2 and 100 then
    raise exception 'A valid governorate is required.'
      using errcode = '22023';
  end if;

  if nullif(btrim(coalesce(p_slug, '')), '') is null then
    v_slug := 'store-' || substr(replace(v_user_id::text, '-', ''), 1, 10) || '-' || p_store_type;
  else
    v_slug := lower(btrim(p_slug));
  end if;

  if char_length(v_slug) not between 3 and 80
     or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Store URL must use lowercase English letters, numbers and hyphens only.'
      using errcode = '22023';
  end if;

  insert into public.stores (
    owner_id,
    store_type,
    name,
    slug,
    description,
    phone,
    contact_email,
    country,
    governorate,
    district,
    address_line,
    status
  )
  values (
    v_user_id,
    p_store_type,
    btrim(p_name),
    v_slug,
    nullif(btrim(coalesce(p_description, '')), ''),
    nullif(btrim(coalesce(p_phone, '')), ''),
    lower(nullif(btrim(coalesce(p_contact_email, '')), '')),
    'Iraq',
    btrim(p_governorate),
    nullif(btrim(coalesce(p_district, '')), ''),
    nullif(btrim(coalesce(p_address_line, '')), ''),
    'pending'
  )
  returning id into v_store_id;

  return v_store_id;
exception
  when unique_violation then
    raise exception 'A store application already exists for this role, or the store URL is already taken.'
      using errcode = '23505';
end;
$$;

revoke all on function public.submit_merchant_store(text, text, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.submit_merchant_store(text, text, text, text, text, text, text, text, text)
  to authenticated;

-- Review is a single atomic operation: approval/rejection and audit event commit together.
create or replace function public.review_merchant_store(
  p_store_id uuid,
  p_decision text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reviewer uuid := auth.uid();
  v_store public.stores%rowtype;
  v_status text;
begin
  if v_reviewer is null then
    raise exception 'Authentication is required.'
      using errcode = '28000';
  end if;

  if not (select private.is_super_admin()) then
    raise exception 'Only Super Admin can review store applications.'
      using errcode = '42501';
  end if;

  if p_decision not in ('approve', 'reject') then
    raise exception 'Decision must be approve or reject.'
      using errcode = '22023';
  end if;

  if p_note is not null and char_length(p_note) > 1000 then
    raise exception 'Review note is too long.'
      using errcode = '22023';
  end if;

  select *
  into v_store
  from public.stores
  where id = p_store_id
    and store_type <> 'shakh_store'
  for update;

  if not found then
    raise exception 'Store application not found.'
      using errcode = 'P0002';
  end if;

  if v_store.status <> 'pending' then
    raise exception 'Only pending store applications can be reviewed.'
      using errcode = '55000';
  end if;

  v_status := case when p_decision = 'approve' then 'active' else 'rejected' end;

  update public.stores
  set status = v_status,
      review_note = nullif(btrim(coalesce(p_note, '')), ''),
      approved_by = case when p_decision = 'approve' then v_reviewer else null end,
      approved_at = case when p_decision = 'approve' then now() else null end
  where id = p_store_id;

  insert into public.store_review_events (
    store_id,
    reviewed_by,
    decision,
    note
  )
  values (
    p_store_id,
    v_reviewer,
    case when p_decision = 'approve' then 'approved' else 'rejected' end,
    nullif(btrim(coalesce(p_note, '')), '')
  );

  return p_store_id;
end;
$$;

revoke all on function public.review_merchant_store(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.review_merchant_store(uuid, text, text)
  to authenticated;

-- One dedicated platform store is provisioned by the migration, not a demo record.
insert into public.stores (
  owner_id,
  store_type,
  name,
  slug,
  description,
  country,
  status
)
values (
  null,
  'shakh_store',
  'SHAKH STORE',
  'shakh-store',
  'Official platform-owned store for SHAKH STORE catalog items.',
  'Iraq',
  'active'
)
on conflict (slug) do nothing;

comment on table public.stores is
  'Merchant store applications and approved stores. The single SHAKH STORE row is platform-owned with a null owner_id.';
comment on table public.store_review_events is
  'Append-only audit history for Super Admin merchant store approval and rejection decisions.';
comment on function public.submit_merchant_store(text, text, text, text, text, text, text, text, text) is
  'Creates a pending store application after verifying the authenticated user holds the role matching the requested store type.';
comment on function public.review_merchant_store(uuid, text, text) is
  'Atomically approves or rejects one pending merchant store application and records an immutable review event.';
