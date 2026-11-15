-- SHAKH STORE M04: role-scoped product catalog and public product images.
-- Depends on M03 (stores + merchant role mapping). Additive only.
-- Do not apply to production until a restorable backup and the M03 validation gate are complete.

create or replace function private.can_manage_store(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.stores s
    where s.id = p_store_id
      and s.status = 'active'
      and (
        (
          s.store_type = 'shakh_store'
          and s.owner_id is null
          and (select private.is_super_admin())
        )
        or (
          s.owner_id = (select auth.uid())
          and exists (
            select 1
            from public.user_roles ur
            where ur.user_id = (select auth.uid())
              and ur.role = case s.store_type
                when 'restaurant' then 'restaurant'::public.app_role
                when 'supermarket' then 'supermarket'::public.app_role
                when 'meat_seafood' then 'meat_seafood_vendor'::public.app_role
                when 'baqal' then 'baqal'::public.app_role
                else null
              end
          )
        )
      )
  );
$$;

revoke all on function private.can_manage_store(uuid) from public, anon;
grant execute on function private.can_manage_store(uuid) to authenticated;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  category text not null,
  name text not null,
  slug text not null,
  description text,
  price_iqd bigint not null,
  unit_label text not null default 'piece',
  stock_quantity numeric(14,3),
  image_path text not null,
  status text not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint products_category_allowed check (
    category in (
      'restaurant',
      'supermarket',
      'meat_seafood',
      'baqal',
      'produce',
      'drinks',
      'household',
      'other'
    )
  ),
  constraint products_name_length check (char_length(btrim(name)) between 2 and 120),
  constraint products_slug_format check (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and char_length(slug) between 3 and 100
  ),
  constraint products_description_length check (
    description is null or char_length(description) <= 2000
  ),
  constraint products_price_iqd_positive check (
    price_iqd between 1 and 100000000000
  ),
  constraint products_unit_label_length check (
    char_length(btrim(unit_label)) between 1 and 32
  ),
  constraint products_stock_nonnegative check (
    stock_quantity is null or stock_quantity >= 0
  ),
  constraint products_image_path_shape check (
    image_path ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}\\.(jpg|jpeg|png|webp)$'
  ),
  constraint products_status_allowed check (
    status in ('published', 'draft', 'archived')
  ),
  constraint products_store_slug_unique unique (store_id, slug)
);

create index products_store_status_created_idx
  on public.products (store_id, status, created_at desc);
create index products_category_status_created_idx
  on public.products (category, status, created_at desc);
create index products_created_by_idx
  on public.products (created_by);

create trigger products_set_updated_at
before update on public.products
for each row execute function private.set_updated_at();

alter table public.products enable row level security;

create policy products_public_read_published
on public.products
for select
to anon
using (
  status = 'published'
  and exists (
    select 1
    from public.stores s
    where s.id = store_id
      and s.status = 'active'
  )
);

create policy products_authenticated_read
on public.products
for select
to authenticated
using (
  (
    status = 'published'
    and exists (
      select 1
      from public.stores s
      where s.id = store_id
        and s.status = 'active'
    )
  )
  or (select private.can_manage_store(store_id))
);

-- Clients can read catalog rows but all product writes must use the checked RPCs.
revoke all on table public.products from anon, authenticated;
grant select on table public.products to anon, authenticated;

-- Public cover images; upload and delete are allowed only inside a store the caller manages.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy product_images_public_read
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'product-images');

create policy product_images_insert_for_store_managers
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.stores s
    where s.id::text = (storage.foldername(name))[1]
      and (select private.can_manage_store(s.id))
  )
);

create policy product_images_delete_for_store_managers
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.stores s
    where s.id::text = (storage.foldername(name))[1]
      and (select private.can_manage_store(s.id))
  )
);

create or replace function public.create_store_product(
  p_store_id uuid,
  p_category text,
  p_name text,
  p_slug text,
  p_description text,
  p_price_iqd bigint,
  p_unit_label text,
  p_stock_quantity numeric,
  p_image_path text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_type text;
  v_slug text;
  v_product_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.'
      using errcode = '28000';
  end if;

  if not (select private.can_manage_store(p_store_id)) then
    raise exception 'You cannot publish products in this store.'
      using errcode = '42501';
  end if;

  select store_type
  into v_store_type
  from public.stores
  where id = p_store_id
    and status = 'active';

  if not found then
    raise exception 'Active store not found.'
      using errcode = 'P0002';
  end if;

  if p_category not in (
    'restaurant', 'supermarket', 'meat_seafood', 'baqal',
    'produce', 'drinks', 'household', 'other'
  ) then
    raise exception 'Unsupported product category.'
      using errcode = '22023';
  end if;

  if v_store_type <> 'shakh_store' and p_category <> v_store_type then
    raise exception 'Merchants may publish only in their assigned store category.'
      using errcode = '42501';
  end if;

  if p_name is null or char_length(btrim(p_name)) not between 2 and 120 then
    raise exception 'Product name must contain between 2 and 120 characters.'
      using errcode = '22023';
  end if;

  if p_description is not null and char_length(p_description) > 2000 then
    raise exception 'Product description is too long.'
      using errcode = '22023';
  end if;

  if p_price_iqd is null or p_price_iqd not between 1 and 100000000000 then
    raise exception 'Enter a valid price in IQD.'
      using errcode = '22023';
  end if;

  if p_unit_label is null or char_length(btrim(p_unit_label)) not between 1 and 32 then
    raise exception 'Enter a valid product unit.'
      using errcode = '22023';
  end if;

  if p_stock_quantity is not null and p_stock_quantity < 0 then
    raise exception 'Stock quantity cannot be negative.'
      using errcode = '22023';
  end if;

  if p_slug is null or nullif(btrim(p_slug), '') is null then
    v_slug := 'product-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  else
    v_slug := lower(btrim(p_slug));
  end if;

  if char_length(v_slug) not between 3 and 100
     or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Product URL must contain lowercase English letters, numbers and hyphens only.'
      using errcode = '22023';
  end if;

  if p_image_path is null
     or p_image_path !~ ('^' || p_store_id::text || '/[0-9a-fA-F-]{36}\\.(jpg|jpeg|png|webp)$')
     or not exists (
       select 1
       from storage.objects o
       where o.bucket_id = 'product-images'
         and o.name = p_image_path
     ) then
    raise exception 'A valid product image must be uploaded to this store first.'
      using errcode = '22023';
  end if;

  insert into public.products (
    store_id,
    created_by,
    category,
    name,
    slug,
    description,
    price_iqd,
    unit_label,
    stock_quantity,
    image_path,
    status
  )
  values (
    p_store_id,
    auth.uid(),
    p_category,
    btrim(p_name),
    v_slug,
    nullif(btrim(coalesce(p_description, '')), ''),
    p_price_iqd,
    btrim(p_unit_label),
    p_stock_quantity,
    p_image_path,
    'published'
  )
  returning id into v_product_id;

  return v_product_id;
exception
  when unique_violation then
    raise exception 'A product with this URL already exists in the selected store.'
      using errcode = '23505';
end;
$$;

create or replace function public.update_store_product(
  p_product_id uuid,
  p_category text,
  p_name text,
  p_slug text,
  p_description text,
  p_price_iqd bigint,
  p_unit_label text,
  p_stock_quantity numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid;
  v_store_type text;
  v_slug text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.'
      using errcode = '28000';
  end if;

  select p.store_id, s.store_type
  into v_store_id, v_store_type
  from public.products p
  join public.stores s on s.id = p.store_id
  where p.id = p_product_id
  for update of p;

  if not found then
    raise exception 'Product not found.'
      using errcode = 'P0002';
  end if;

  if not (select private.can_manage_store(v_store_id)) then
    raise exception 'You cannot edit products in this store.'
      using errcode = '42501';
  end if;

  if p_category not in (
    'restaurant', 'supermarket', 'meat_seafood', 'baqal',
    'produce', 'drinks', 'household', 'other'
  ) then
    raise exception 'Unsupported product category.'
      using errcode = '22023';
  end if;

  if v_store_type <> 'shakh_store' and p_category <> v_store_type then
    raise exception 'Merchants may publish only in their assigned store category.'
      using errcode = '42501';
  end if;

  if p_name is null or char_length(btrim(p_name)) not between 2 and 120
     or p_price_iqd is null or p_price_iqd not between 1 and 100000000000
     or p_unit_label is null or char_length(btrim(p_unit_label)) not between 1 and 32
     or (p_stock_quantity is not null and p_stock_quantity < 0)
     or (p_description is not null and char_length(p_description) > 2000) then
    raise exception 'Product details are invalid.'
      using errcode = '22023';
  end if;

  v_slug := lower(btrim(coalesce(p_slug, '')));
  if char_length(v_slug) not between 3 and 100
     or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Product URL must contain lowercase English letters, numbers and hyphens only.'
      using errcode = '22023';
  end if;

  update public.products
  set category = p_category,
      name = btrim(p_name),
      slug = v_slug,
      description = nullif(btrim(coalesce(p_description, '')), ''),
      price_iqd = p_price_iqd,
      unit_label = btrim(p_unit_label),
      stock_quantity = p_stock_quantity
  where id = p_product_id;

  return p_product_id;
exception
  when unique_violation then
    raise exception 'A product with this URL already exists in the selected store.'
      using errcode = '23505';
end;
$$;

create or replace function public.set_store_product_status(
  p_product_id uuid,
  p_status text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.'
      using errcode = '28000';
  end if;

  if p_status not in ('published', 'draft', 'archived') then
    raise exception 'Unsupported product status.'
      using errcode = '22023';
  end if;

  select store_id
  into v_store_id
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'Product not found.'
      using errcode = 'P0002';
  end if;

  if not (select private.can_manage_store(v_store_id)) then
    raise exception 'You cannot change products in this store.'
      using errcode = '42501';
  end if;

  update public.products
  set status = p_status
  where id = p_product_id;

  return p_product_id;
end;
$$;

revoke all on function public.create_store_product(uuid, text, text, text, text, bigint, text, numeric, text)
  from public, anon, authenticated;
revoke all on function public.update_store_product(uuid, text, text, text, text, bigint, text, numeric)
  from public, anon, authenticated;
revoke all on function public.set_store_product_status(uuid, text)
  from public, anon, authenticated;

grant execute on function public.create_store_product(uuid, text, text, text, text, bigint, text, numeric, text)
  to authenticated;
grant execute on function public.update_store_product(uuid, text, text, text, text, bigint, text, numeric)
  to authenticated;
grant execute on function public.set_store_product_status(uuid, text)
  to authenticated;

comment on table public.products is
  'IQD-priced catalog products. Super Admin publishes only in the platform-owned SHAKH STORE; merchants publish only in their own approved category store.';
comment on function private.can_manage_store(uuid) is
  'Checks whether the authenticated user may manage a specific active store based on database roles and ownership.';
comment on function public.create_store_product(uuid, text, text, text, text, bigint, text, numeric, text) is
  'Creates a published IQD-priced product after enforcing store ownership, role/category mapping and an uploaded cover image.';
comment on function public.update_store_product(uuid, text, text, text, text, bigint, text, numeric) is
  'Updates product details only when the caller manages the product store and category boundary.';
comment on function public.set_store_product_status(uuid, text) is
  'Changes a product between published, draft and archived without exposing direct client table writes.';
