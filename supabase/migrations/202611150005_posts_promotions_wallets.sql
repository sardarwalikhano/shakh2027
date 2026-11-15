-- SHAKH STORE M05: posts, promotions and merchant reward-budget reservations.
-- Depends on M03 stores and M04 products/private.can_manage_store.
-- Additive only. Do not apply to production without a restorable backup and non-production tests.
-- This migration does not add wallet top-up credits; available balances remain zero until M09
-- implements proof-based FastPay/FIB submission and Super Admin approval.

create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  wallet_type text not null,
  store_id uuid references public.stores(id) on delete restrict,
  user_id uuid references auth.users(id) on delete restrict,
  available_iqd bigint not null default 0,
  reserved_iqd bigint not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint wallets_type_allowed check (
    wallet_type in ('merchant', 'captain', 'customer')
  ),
  constraint wallets_scope_guard check (
    (wallet_type = 'merchant' and store_id is not null and user_id is null)
    or
    (wallet_type in ('captain', 'customer') and store_id is null and user_id is not null)
  ),
  constraint wallets_available_nonnegative check (available_iqd >= 0),
  constraint wallets_reserved_nonnegative check (reserved_iqd >= 0),
  constraint wallets_status_allowed check (status in ('active', 'frozen'))
);

create unique index wallets_one_merchant_wallet_per_store_uidx
  on public.wallets (store_id)
  where wallet_type = 'merchant';

create unique index wallets_one_user_wallet_per_type_uidx
  on public.wallets (wallet_type, user_id)
  where user_id is not null;

create index wallets_user_id_idx on public.wallets (user_id);
create index wallets_store_id_idx on public.wallets (store_id);

create trigger wallets_set_updated_at
before update on public.wallets
for each row execute function private.set_updated_at();

alter table public.wallets enable row level security;

create policy wallets_owner_or_admin_read
on public.wallets
for select
to authenticated
using (
  (select private.is_super_admin())
  or (
    wallet_type = 'merchant'
    and exists (
      select 1
      from public.stores s
      where s.id = store_id
        and s.owner_id = (select auth.uid())
    )
  )
  or (wallet_type in ('captain', 'customer') and user_id = (select auth.uid()))
);

-- Every active merchant store, including the platform-owned SHAKH STORE row,
-- receives one zero-balance merchant wallet. Funding is deliberately a later,
-- proof-based top-up workflow and is not simulated by this migration.
create or replace function private.ensure_merchant_wallet()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' then
    insert into public.wallets (wallet_type, store_id)
    values ('merchant', new.id)
    on conflict (store_id) where wallet_type = 'merchant' do nothing;
  end if;

  return new;
end;
$$;

revoke all on function private.ensure_merchant_wallet() from public, anon, authenticated;

create trigger stores_create_merchant_wallet
after insert or update of status on public.stores
for each row
when (new.status = 'active')
execute function private.ensure_merchant_wallet();

insert into public.wallets (wallet_type, store_id)
select 'merchant', s.id
from public.stores s
where s.status = 'active'
on conflict (store_id) where wallet_type = 'merchant' do nothing;

revoke all on table public.wallets from anon, authenticated;
grant select on table public.wallets to authenticated;

create table public.wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete restrict,
  entry_type text not null,
  amount_iqd bigint not null,
  available_delta_iqd bigint not null,
  reserved_delta_iqd bigint not null,
  available_after_iqd bigint not null,
  reserved_after_iqd bigint not null,
  reference_type text not null,
  reference_id uuid not null,
  idempotency_key text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint wallet_ledger_entry_type_allowed check (
    entry_type in (
      'promotion_reserve',
      'promotion_release',
      'promotion_reward_settlement',
      'topup_credit',
      'captain_commission_debit',
      'cashout_reserve',
      'cashout_release',
      'manual_adjustment'
    )
  ),
  constraint wallet_ledger_amount_positive check (amount_iqd > 0),
  constraint wallet_ledger_balances_nonnegative check (
    available_after_iqd >= 0 and reserved_after_iqd >= 0
  ),
  constraint wallet_ledger_metadata_object check (
    jsonb_typeof(metadata) = 'object'
  ),
  constraint wallet_ledger_idempotency_length check (
    char_length(btrim(idempotency_key)) between 12 and 160
  )
);

create index wallet_ledger_wallet_created_idx
  on public.wallet_ledger (wallet_id, created_at desc);
create index wallet_ledger_reference_idx
  on public.wallet_ledger (reference_type, reference_id);
create index wallet_ledger_created_by_idx
  on public.wallet_ledger (created_by);

alter table public.wallet_ledger enable row level security;

create policy wallet_ledger_owner_or_admin_read
on public.wallet_ledger
for select
to authenticated
using (
  (select private.is_super_admin())
  or exists (
    select 1
    from public.wallets w
    left join public.stores s on s.id = w.store_id
    where w.id = wallet_id
      and (
        (w.wallet_type = 'merchant' and s.owner_id = (select auth.uid()))
        or (w.wallet_type in ('captain', 'customer') and w.user_id = (select auth.uid()))
      )
  )
);

create or replace function private.prevent_wallet_ledger_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Wallet ledger entries are immutable.'
    using errcode = '55000';
end;
$$;

revoke all on function private.prevent_wallet_ledger_mutation() from public, anon, authenticated;

create trigger wallet_ledger_immutable
before update or delete on public.wallet_ledger
for each row execute function private.prevent_wallet_ledger_mutation();

revoke all on table public.wallet_ledger from anon, authenticated;
grant select on table public.wallet_ledger to authenticated;

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  post_type text not null,
  title text not null,
  body text,
  image_path text,
  product_id uuid references public.products(id) on delete restrict,
  reward_per_unit_iqd bigint not null default 0,
  max_reward_units bigint not null default 0,
  valid_from timestamptz,
  valid_until timestamptz,
  status text not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint posts_type_allowed check (post_type in ('announcement', 'promotion')),
  constraint posts_title_length check (char_length(btrim(title)) between 2 and 140),
  constraint posts_body_length check (body is null or char_length(body) <= 5000),
  constraint posts_reward_nonnegative check (reward_per_unit_iqd >= 0),
  constraint posts_units_nonnegative check (max_reward_units >= 0),
  constraint posts_status_allowed check (status in ('draft', 'published', 'paused', 'archived')),
  constraint posts_type_reward_shape check (
    (
      post_type = 'announcement'
      and product_id is null
      and reward_per_unit_iqd = 0
      and max_reward_units = 0
      and valid_from is null
      and valid_until is null
    )
    or
    (
      post_type = 'promotion'
      and product_id is not null
      and reward_per_unit_iqd > 0
      and max_reward_units between 1 and 10000000
      and valid_from is not null
      and valid_until is not null
      and valid_until > valid_from
    )
  ),
  constraint posts_image_path_shape check (
    image_path is null
    or image_path ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}\\.(jpg|jpeg|png|webp)$'
  )
);

create index posts_store_status_created_idx
  on public.posts (store_id, status, created_at desc);
create index posts_type_status_validity_idx
  on public.posts (post_type, status, valid_from, valid_until);
create index posts_product_id_idx on public.posts (product_id);
create index posts_created_by_idx on public.posts (created_by);

create trigger posts_set_updated_at
before update on public.posts
for each row execute function private.set_updated_at();

alter table public.posts enable row level security;

create policy posts_public_read_published
on public.posts
for select
to anon
using (
  status = 'published'
  and (post_type = 'announcement' or (valid_from <= now() and valid_until > now()))
  and exists (
    select 1
    from public.stores s
    where s.id = store_id
      and s.status = 'active'
  )
);

create policy posts_authenticated_read
on public.posts
for select
to authenticated
using (
  (
    status = 'published'
    and (post_type = 'announcement' or (valid_from <= now() and valid_until > now()))
    and exists (
      select 1
      from public.stores s
      where s.id = store_id
        and s.status = 'active'
    )
  )
  or (select private.can_manage_store(store_id))
);

-- Public reads are allowed only through RLS. Writes go through checked RPCs.
revoke all on table public.posts from anon, authenticated;
grant select on table public.posts to anon, authenticated;

create table public.promotion_budget_reservations (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null unique references public.posts(id) on delete restrict,
  wallet_id uuid not null references public.wallets(id) on delete restrict,
  initial_reward_budget_iqd bigint not null,
  remaining_reward_budget_iqd bigint not null,
  initial_reward_units bigint not null,
  remaining_reward_units bigint not null,
  status text not null default 'reserved',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint promotion_reservation_initial_amount check (initial_reward_budget_iqd > 0),
  constraint promotion_reservation_remaining_amount check (
    remaining_reward_budget_iqd >= 0
    and remaining_reward_budget_iqd <= initial_reward_budget_iqd
  ),
  constraint promotion_reservation_initial_units check (initial_reward_units > 0),
  constraint promotion_reservation_remaining_units check (
    remaining_reward_units >= 0
    and remaining_reward_units <= initial_reward_units
  ),
  constraint promotion_reservation_status check (
    status in ('reserved', 'released', 'exhausted')
  )
);

create index promotion_reservations_wallet_status_idx
  on public.promotion_budget_reservations (wallet_id, status);
create trigger promotion_reservations_set_updated_at
before update on public.promotion_budget_reservations
for each row execute function private.set_updated_at();

alter table public.promotion_budget_reservations enable row level security;

create policy promotion_reservations_owner_or_admin_read
on public.promotion_budget_reservations
for select
to authenticated
using (
  (select private.is_super_admin())
  or exists (
    select 1
    from public.wallets w
    left join public.stores s on s.id = w.store_id
    where w.id = wallet_id
      and w.wallet_type = 'merchant'
      and s.owner_id = (select auth.uid())
  )
);

revoke all on table public.promotion_budget_reservations from anon, authenticated;
grant select on table public.promotion_budget_reservations to authenticated;

-- Public images; upload and deletion are scoped to a store the user can manage.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-images',
  'post-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy post_images_public_read
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'post-images');

create policy post_images_insert_for_store_managers
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'post-images'
  and exists (
    select 1
    from public.stores s
    where s.id::text = (storage.foldername(name))[1]
      and (select private.can_manage_store(s.id))
  )
);

create policy post_images_delete_for_store_managers
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'post-images'
  and exists (
    select 1
    from public.stores s
    where s.id::text = (storage.foldername(name))[1]
      and (select private.can_manage_store(s.id))
  )
);

create or replace function public.create_store_post(
  p_store_id uuid,
  p_post_type text,
  p_title text,
  p_body text,
  p_image_path text,
  p_product_id uuid default null,
  p_reward_per_unit_iqd bigint default 0,
  p_max_reward_units bigint default 0,
  p_valid_from timestamptz default null,
  p_valid_until timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.'
      using errcode = '28000';
  end if;

  if not (select private.can_manage_store(p_store_id)) then
    raise exception 'You cannot create posts in this store.'
      using errcode = '42501';
  end if;

  if p_post_type not in ('announcement', 'promotion') then
    raise exception 'Unsupported post type.'
      using errcode = '22023';
  end if;

  if p_title is null or char_length(btrim(p_title)) not between 2 and 140 then
    raise exception 'Post title must contain between 2 and 140 characters.'
      using errcode = '22023';
  end if;

  if p_body is not null and char_length(p_body) > 5000 then
    raise exception 'Post text is too long.'
      using errcode = '22023';
  end if;

  if p_image_path is not null and (
    p_image_path !~ ('^' || p_store_id::text || '/[0-9a-fA-F-]{36}\\.(jpg|jpeg|png|webp)$')
    or not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'post-images' and o.name = p_image_path
    )
  ) then
    raise exception 'Post image is not a valid upload for this store.'
      using errcode = '22023';
  end if;

  if p_post_type = 'announcement' then
    if p_product_id is not null
       or coalesce(p_reward_per_unit_iqd, 0) <> 0
       or coalesce(p_max_reward_units, 0) <> 0
       or p_valid_from is not null
       or p_valid_until is not null then
      raise exception 'Announcements cannot define a product reward budget.'
        using errcode = '22023';
    end if;
  else
    if p_product_id is null
       or p_reward_per_unit_iqd is null
       or p_reward_per_unit_iqd < 1
       or p_max_reward_units is null
       or p_max_reward_units not between 1 and 10000000
       or p_valid_from is null
       or p_valid_until is null
       or p_valid_until <= p_valid_from then
      raise exception 'Promotion product, fixed per-unit reward, unit limit and validity dates are required.'
        using errcode = '22023';
    end if;

    if not exists (
      select 1
      from public.products p
      where p.id = p_product_id
        and p.store_id = p_store_id
        and p.status = 'published'
    ) then
      raise exception 'Promotion product must be a published product in the same store.'
        using errcode = '22023';
    end if;

    if (p_reward_per_unit_iqd::numeric * p_max_reward_units::numeric) > 9223372036854775807::numeric then
      raise exception 'Promotion budget is too large.'
        using errcode = '22003';
    end if;
  end if;

  insert into public.posts (
    store_id,
    created_by,
    post_type,
    title,
    body,
    image_path,
    product_id,
    reward_per_unit_iqd,
    max_reward_units,
    valid_from,
    valid_until,
    status
  )
  values (
    p_store_id,
    auth.uid(),
    p_post_type,
    btrim(p_title),
    nullif(btrim(coalesce(p_body, '')), ''),
    p_image_path,
    p_product_id,
    coalesce(p_reward_per_unit_iqd, 0),
    coalesce(p_max_reward_units, 0),
    p_valid_from,
    p_valid_until,
    'draft'
  )
  returning id into v_post_id;

  return v_post_id;
end;
$$;

create or replace function public.update_draft_store_post(
  p_post_id uuid,
  p_title text,
  p_body text,
  p_product_id uuid default null,
  p_reward_per_unit_iqd bigint default 0,
  p_max_reward_units bigint default 0,
  p_valid_from timestamptz default null,
  p_valid_until timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post public.posts%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.'
      using errcode = '28000';
  end if;

  select * into v_post
  from public.posts
  where id = p_post_id
  for update;

  if not found then
    raise exception 'Post not found.'
      using errcode = 'P0002';
  end if;

  if not (select private.can_manage_store(v_post.store_id)) then
    raise exception 'You cannot edit this post.'
      using errcode = '42501';
  end if;

  if v_post.status <> 'draft' then
    raise exception 'Only draft posts can be edited.'
      using errcode = '55000';
  end if;

  if p_title is null or char_length(btrim(p_title)) not between 2 and 140
     or (p_body is not null and char_length(p_body) > 5000) then
    raise exception 'Post details are invalid.'
      using errcode = '22023';
  end if;

  if v_post.post_type = 'announcement' then
    if p_product_id is not null
       or coalesce(p_reward_per_unit_iqd, 0) <> 0
       or coalesce(p_max_reward_units, 0) <> 0
       or p_valid_from is not null
       or p_valid_until is not null then
      raise exception 'Announcements cannot define a product reward budget.'
        using errcode = '22023';
    end if;
  else
    if p_product_id is null
       or p_reward_per_unit_iqd is null
       or p_reward_per_unit_iqd < 1
       or p_max_reward_units is null
       or p_max_reward_units not between 1 and 10000000
       or p_valid_from is null
       or p_valid_until is null
       or p_valid_until <= p_valid_from
       or (p_reward_per_unit_iqd::numeric * p_max_reward_units::numeric) > 9223372036854775807::numeric then
      raise exception 'Promotion details are invalid.'
        using errcode = '22023';
    end if;

    if not exists (
      select 1
      from public.products p
      where p.id = p_product_id
        and p.store_id = v_post.store_id
        and p.status = 'published'
    ) then
      raise exception 'Promotion product must be published in the same store.'
        using errcode = '22023';
    end if;
  end if;

  update public.posts
  set title = btrim(p_title),
      body = nullif(btrim(coalesce(p_body, '')), ''),
      product_id = p_product_id,
      reward_per_unit_iqd = coalesce(p_reward_per_unit_iqd, 0),
      max_reward_units = coalesce(p_max_reward_units, 0),
      valid_from = p_valid_from,
      valid_until = p_valid_until
  where id = p_post_id;

  return p_post_id;
end;
$$;

create or replace function public.publish_store_post(p_post_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post public.posts%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.'
      using errcode = '28000';
  end if;

  select * into v_post from public.posts where id = p_post_id for update;
  if not found then
    raise exception 'Post not found.' using errcode = 'P0002';
  end if;

  if not (select private.can_manage_store(v_post.store_id)) then
    raise exception 'You cannot publish this post.' using errcode = '42501';
  end if;

  if v_post.post_type <> 'announcement' or v_post.status <> 'draft' then
    raise exception 'Only draft announcements can be published with this action.'
      using errcode = '55000';
  end if;

  update public.posts
  set status = 'published', published_at = now()
  where id = p_post_id;

  return p_post_id;
end;
$$;

create or replace function public.publish_store_promotion(p_post_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post public.posts%rowtype;
  v_wallet public.wallets%rowtype;
  v_reservation_id uuid;
  v_budget_numeric numeric;
  v_budget_iqd bigint;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.'
      using errcode = '28000';
  end if;

  select * into v_post
  from public.posts
  where id = p_post_id
  for update;

  if not found then
    raise exception 'Promotion not found.'
      using errcode = 'P0002';
  end if;

  if not (select private.can_manage_store(v_post.store_id)) then
    raise exception 'You cannot publish this promotion.'
      using errcode = '42501';
  end if;

  if v_post.post_type <> 'promotion' then
    raise exception 'This post is not a promotion.'
      using errcode = '22023';
  end if;

  if v_post.status = 'published' then
    select id into v_reservation_id
    from public.promotion_budget_reservations
    where post_id = p_post_id
      and status = 'reserved';

    if v_reservation_id is not null then
      return v_reservation_id;
    end if;
  end if;

  if v_post.status <> 'draft' then
    raise exception 'Only draft promotions can be published.'
      using errcode = '55000';
  end if;

  if v_post.valid_until <= now() then
    raise exception 'Promotion validity period has already ended.'
      using errcode = '22023';
  end if;

  v_budget_numeric := v_post.reward_per_unit_iqd::numeric * v_post.max_reward_units::numeric;
  if v_budget_numeric <= 0 or v_budget_numeric > 9223372036854775807::numeric then
    raise exception 'Promotion budget is invalid.'
      using errcode = '22003';
  end if;
  v_budget_iqd := v_budget_numeric::bigint;

  select * into v_wallet
  from public.wallets
  where wallet_type = 'merchant'
    and store_id = v_post.store_id
  for update;

  if not found then
    raise exception 'Merchant wallet has not been provisioned. Apply M05 wallet setup first.'
      using errcode = 'P0002';
  end if;

  if v_wallet.status <> 'active' then
    raise exception 'Merchant wallet is frozen.'
      using errcode = '55000';
  end if;

  if v_wallet.available_iqd < v_budget_iqd then
    raise exception 'Insufficient available wallet balance for the promotion reward budget.'
      using errcode = '23514';
  end if;

  update public.wallets
  set available_iqd = available_iqd - v_budget_iqd,
      reserved_iqd = reserved_iqd + v_budget_iqd
  where id = v_wallet.id
  returning * into v_wallet;

  insert into public.promotion_budget_reservations (
    post_id,
    wallet_id,
    initial_reward_budget_iqd,
    remaining_reward_budget_iqd,
    initial_reward_units,
    remaining_reward_units,
    status
  )
  values (
    v_post.id,
    v_wallet.id,
    v_budget_iqd,
    v_budget_iqd,
    v_post.max_reward_units,
    v_post.max_reward_units,
    'reserved'
  )
  returning id into v_reservation_id;

  insert into public.wallet_ledger (
    wallet_id,
    entry_type,
    amount_iqd,
    available_delta_iqd,
    reserved_delta_iqd,
    available_after_iqd,
    reserved_after_iqd,
    reference_type,
    reference_id,
    idempotency_key,
    created_by,
    metadata
  )
  values (
    v_wallet.id,
    'promotion_reserve',
    v_budget_iqd,
    -v_budget_iqd,
    v_budget_iqd,
    v_wallet.available_iqd,
    v_wallet.reserved_iqd,
    'promotion',
    v_post.id,
    'promotion:' || v_post.id::text || ':reserve:v1',
    auth.uid(),
    jsonb_build_object(
      'post_id', v_post.id,
      'reward_per_unit_iqd', v_post.reward_per_unit_iqd,
      'max_reward_units', v_post.max_reward_units
    )
  );

  update public.posts
  set status = 'published', published_at = now()
  where id = p_post_id;

  return v_reservation_id;
end;
$$;

create or replace function public.archive_store_post(p_post_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post public.posts%rowtype;
  v_reservation public.promotion_budget_reservations%rowtype;
  v_wallet public.wallets%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.'
      using errcode = '28000';
  end if;

  select * into v_post
  from public.posts
  where id = p_post_id
  for update;

  if not found then
    raise exception 'Post not found.' using errcode = 'P0002';
  end if;

  if not (select private.can_manage_store(v_post.store_id)) then
    raise exception 'You cannot archive this post.'
      using errcode = '42501';
  end if;

  if v_post.status = 'archived' then
    return p_post_id;
  end if;

  if v_post.post_type = 'promotion' then
    select * into v_reservation
    from public.promotion_budget_reservations
    where post_id = p_post_id
    for update;

    if found and v_reservation.status = 'reserved'
       and v_reservation.remaining_reward_budget_iqd > 0 then
      select * into v_wallet
      from public.wallets
      where id = v_reservation.wallet_id
      for update;

      update public.wallets
      set available_iqd = available_iqd + v_reservation.remaining_reward_budget_iqd,
          reserved_iqd = reserved_iqd - v_reservation.remaining_reward_budget_iqd
      where id = v_wallet.id
      returning * into v_wallet;

      insert into public.wallet_ledger (
        wallet_id,
        entry_type,
        amount_iqd,
        available_delta_iqd,
        reserved_delta_iqd,
        available_after_iqd,
        reserved_after_iqd,
        reference_type,
        reference_id,
        idempotency_key,
        created_by,
        metadata
      )
      values (
        v_wallet.id,
        'promotion_release',
        v_reservation.remaining_reward_budget_iqd,
        v_reservation.remaining_reward_budget_iqd,
        -v_reservation.remaining_reward_budget_iqd,
        v_wallet.available_iqd,
        v_wallet.reserved_iqd,
        'promotion',
        v_post.id,
        'promotion:' || v_post.id::text || ':release:v1',
        auth.uid(),
        jsonb_build_object('post_id', v_post.id, 'reason', 'archived')
      );

      update public.promotion_budget_reservations
      set remaining_reward_budget_iqd = 0,
          remaining_reward_units = 0,
          status = 'released'
      where id = v_reservation.id;
    end if;
  end if;

  update public.posts
  set status = 'archived'
  where id = p_post_id;

  return p_post_id;
end;
$$;

revoke all on function public.create_store_post(uuid, text, text, text, text, uuid, bigint, bigint, timestamptz, timestamptz)
  from public, anon, authenticated;
revoke all on function public.update_draft_store_post(uuid, text, text, uuid, bigint, bigint, timestamptz, timestamptz)
  from public, anon, authenticated;
revoke all on function public.publish_store_post(uuid)
  from public, anon, authenticated;
revoke all on function public.publish_store_promotion(uuid)
  from public, anon, authenticated;
revoke all on function public.archive_store_post(uuid)
  from public, anon, authenticated;

grant execute on function public.create_store_post(uuid, text, text, text, text, uuid, bigint, bigint, timestamptz, timestamptz)
  to authenticated;
grant execute on function public.update_draft_store_post(uuid, text, text, uuid, bigint, bigint, timestamptz, timestamptz)
  to authenticated;
grant execute on function public.publish_store_post(uuid)
  to authenticated;
grant execute on function public.publish_store_promotion(uuid)
  to authenticated;
grant execute on function public.archive_store_post(uuid)
  to authenticated;

comment on table public.wallets is
  'Unified IQD wallet accounts. Client roles may read permitted wallets only; all balance changes occur through atomic database functions.';
comment on table public.wallet_ledger is
  'Append-only immutable financial ledger. Direct client inserts, updates and deletes are never granted.';
comment on table public.posts is
  'Merchant and platform announcements/promotions. Promotion publication requires an atomic wallet reward-budget reservation.';
comment on table public.promotion_budget_reservations is
  'Holds the fixed per-unit promotion reward budget until later delivered-order settlement or release.';
comment on function public.publish_store_promotion(uuid) is
  'Atomically reserves reward_per_unit_iqd × max_reward_units from the merchant store wallet and publishes the promotion.';
comment on function public.archive_store_post(uuid) is
  'Archives a post; releases any unconsumed promotion budget atomically and records an immutable ledger entry.';
