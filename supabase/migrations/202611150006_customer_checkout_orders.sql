-- SHAKH STORE M06: customer cart checkout and cash-on-delivery orders.
-- Depends on M03 stores and M04 products. M05 is not required for this schema.
-- Additive only. No order/demo rows or wallet balances are seeded.

create sequence public.order_number_seq start with 10000001;

create table public.store_delivery_settings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null unique references public.stores(id) on delete restrict,
  delivery_fee_iqd bigint not null,
  is_enabled boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_delivery_fee_range check (delivery_fee_iqd between 0 and 5000000)
);

create index store_delivery_settings_enabled_idx
  on public.store_delivery_settings (is_enabled, store_id);

create trigger store_delivery_settings_set_updated_at
before update on public.store_delivery_settings
for each row execute function private.set_updated_at();

alter table public.store_delivery_settings enable row level security;

create policy store_delivery_settings_public_read
on public.store_delivery_settings
for select
to anon, authenticated
using (
  is_enabled
  and exists (
    select 1
    from public.stores s
    where s.id = store_id
      and s.status = 'active'
  )
);

create policy store_delivery_settings_super_admin_read
on public.store_delivery_settings
for select
to authenticated
using ((select private.is_super_admin()));

revoke all on table public.store_delivery_settings from anon, authenticated;
grant select on table public.store_delivery_settings to anon, authenticated;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  checkout_group_id uuid not null,
  checkout_request_id uuid not null,
  order_number text not null unique default (
    'SHK-' || lpad(nextval('public.order_number_seq')::text, 8, '0')
  ),
  customer_id uuid not null references auth.users(id) on delete restrict,
  store_id uuid not null references public.stores(id) on delete restrict,
  status text not null default 'placed',
  payment_method text not null default 'cash_on_delivery',
  payment_status text not null default 'unpaid',
  customer_name text not null,
  customer_phone text not null,
  delivery_address text not null,
  delivery_note text,
  subtotal_iqd bigint not null,
  delivery_fee_iqd bigint not null,
  total_iqd bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint orders_checkout_request_store_unique unique (
    customer_id, checkout_request_id, store_id
  ),
  constraint orders_status_allowed check (
    status in ('placed', 'accepted', 'preparing', 'ready_for_pickup',
      'assigned', 'picked_up', 'delivered', 'cancelled')
  ),
  constraint orders_payment_method_cod check (payment_method = 'cash_on_delivery'),
  constraint orders_payment_status_allowed check (
    payment_status in ('unpaid', 'paid', 'refunded')
  ),
  constraint orders_customer_name_length check (
    char_length(btrim(customer_name)) between 2 and 120
  ),
  constraint orders_customer_phone_length check (
    char_length(btrim(customer_phone)) between 7 and 32
  ),
  constraint orders_delivery_address_length check (
    char_length(btrim(delivery_address)) between 5 and 500
  ),
  constraint orders_delivery_note_length check (
    delivery_note is null or char_length(delivery_note) <= 1000
  ),
  constraint orders_amounts_nonnegative check (
    subtotal_iqd >= 0 and delivery_fee_iqd >= 0
      and total_iqd = subtotal_iqd + delivery_fee_iqd
  )
);

create index orders_customer_created_idx
  on public.orders (customer_id, created_at desc);
create index orders_store_status_created_idx
  on public.orders (store_id, status, created_at desc);
create index orders_checkout_group_idx
  on public.orders (checkout_group_id);
create index orders_status_created_idx
  on public.orders (status, created_at);

create trigger orders_set_updated_at
before update on public.orders
for each row execute function private.set_updated_at();

alter table public.orders enable row level security;

create policy orders_customer_merchant_admin_read
on public.orders
for select
to authenticated
using (
  customer_id = (select auth.uid())
  or (select private.is_super_admin())
  or exists (
    select 1
    from public.stores s
    where s.id = store_id
      and s.owner_id = (select auth.uid())
  )
);

revoke all on table public.orders from anon, authenticated;
grant select on table public.orders to authenticated;

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  product_name text not null,
  unit_label text not null,
  unit_price_iqd bigint not null,
  quantity numeric(14,3) not null,
  line_total_iqd bigint not null,
  image_path text not null,
  created_at timestamptz not null default now(),

  constraint order_items_name_length check (
    char_length(btrim(product_name)) between 2 and 120
  ),
  constraint order_items_unit_length check (
    char_length(btrim(unit_label)) between 1 and 32
  ),
  constraint order_items_price_positive check (unit_price_iqd > 0),
  constraint order_items_quantity_positive check (
    quantity > 0 and quantity <= 100000
      and quantity * 1000 = trunc(quantity * 1000)
  ),
  constraint order_items_total_positive check (line_total_iqd > 0),
  constraint order_items_one_product_per_order unique (order_id, product_id)
);

create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_product_id_idx on public.order_items (product_id);

alter table public.order_items enable row level security;

create policy order_items_visible_with_order
on public.order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_id
      and (
        o.customer_id = (select auth.uid())
        or (select private.is_super_admin())
        or exists (
          select 1
          from public.stores s
          where s.id = o.store_id
            and s.owner_id = (select auth.uid())
        )
      )
  )
);

revoke all on table public.order_items from anon, authenticated;
grant select on table public.order_items to authenticated;

create or replace function public.set_store_delivery_fee(
  p_store_id uuid,
  p_delivery_fee_iqd bigint,
  p_is_enabled boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.'
      using errcode = '28000';
  end if;

  if not (select private.is_super_admin()) then
    raise exception 'Only Super Admin can configure store delivery fees.'
      using errcode = '42501';
  end if;

  if p_delivery_fee_iqd is null or p_delivery_fee_iqd not between 0 and 5000000
     or p_is_enabled is null then
    raise exception 'Delivery fee configuration is invalid.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.stores
    where id = p_store_id and status = 'active'
  ) then
    raise exception 'Active store not found.'
      using errcode = 'P0002';
  end if;

  insert into public.store_delivery_settings (
    store_id, delivery_fee_iqd, is_enabled, updated_by
  )
  values (p_store_id, p_delivery_fee_iqd, p_is_enabled, auth.uid())
  on conflict (store_id) do update
  set delivery_fee_iqd = excluded.delivery_fee_iqd,
      is_enabled = excluded.is_enabled,
      updated_by = excluded.updated_by
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.create_cod_checkout(
  p_checkout_request_id uuid,
  p_items jsonb,
  p_customer_name text,
  p_customer_phone text,
  p_delivery_address text,
  p_delivery_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer uuid := auth.uid();
  v_item_count integer;
  v_distinct_count integer;
  v_checkout_group uuid := gen_random_uuid();
  v_order_id uuid;
  v_order_number text;
  v_store record;
  v_subtotal bigint;
  v_total bigint;
  v_orders jsonb := '[]'::jsonb;
  v_order_count integer := 0;
begin
  if v_customer is null then
    raise exception 'Authentication is required.'
      using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = v_customer and ur.role = 'customer'::public.app_role
  ) then
    raise exception 'A customer role is required to place an order.'
      using errcode = '42501';
  end if;

  if p_checkout_request_id is null then
    raise exception 'A checkout request key is required.'
      using errcode = '22023';
  end if;

  -- Serialize retries using the same customer/request key. A lost response can safely retry.
  perform pg_advisory_xact_lock(
    hashtextextended(v_customer::text || ':' || p_checkout_request_id::text, 0)
  );

  if exists (
    select 1 from public.orders
    where customer_id = v_customer
      and checkout_request_id = p_checkout_request_id
  ) then
    select checkout_group_id
    into v_checkout_group
    from public.orders
    where customer_id = v_customer
      and checkout_request_id = p_checkout_request_id
    limit 1;

    select count(*)::integer
    into v_order_count
    from public.orders
    where customer_id = v_customer
      and checkout_request_id = p_checkout_request_id;

    select coalesce(jsonb_agg(jsonb_build_object(
      'order_id', o.id,
      'order_number', o.order_number,
      'store_id', o.store_id,
      'subtotal_iqd', o.subtotal_iqd,
      'delivery_fee_iqd', o.delivery_fee_iqd,
      'total_iqd', o.total_iqd
    ) order by o.store_id), '[]'::jsonb)
    into v_orders
    from public.orders o
    where o.customer_id = v_customer
      and o.checkout_request_id = p_checkout_request_id;

    return jsonb_build_object(
      'checkout_group_id', v_checkout_group,
      'order_count', v_order_count,
      'orders', v_orders,
      'idempotent_replay', true
    );
  end if;

  if jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'Cart must contain between 1 and 50 products.'
      using errcode = '22023';
  end if;

  if p_customer_name is null or char_length(btrim(p_customer_name)) not between 2 and 120
     or p_customer_phone is null or char_length(btrim(p_customer_phone)) not between 7 and 32
     or p_delivery_address is null or char_length(btrim(p_delivery_address)) not between 5 and 500
     or (p_delivery_note is not null and char_length(p_delivery_note) > 1000) then
    raise exception 'Delivery contact information is invalid.'
      using errcode = '22023';
  end if;

  select count(*)::integer, count(distinct x.product_id)::integer
  into v_item_count, v_distinct_count
  from jsonb_to_recordset(p_items) as x(product_id uuid, quantity numeric);

  if v_item_count < 1 or v_item_count > 50 or v_item_count <> v_distinct_count then
    raise exception 'Cart contains invalid or duplicate products.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity numeric)
    where x.product_id is null
       or x.quantity is null
       or x.quantity <= 0
       or x.quantity > 100000
       or x.quantity * 1000 <> trunc(x.quantity * 1000)
  ) then
    raise exception 'Cart quantities must be positive and use at most three decimal places.'
      using errcode = '22023';
  end if;

  -- Lock products, stores and fee settings in stable order to avoid stock and fee races.
  perform p.id
  from public.products p
  join jsonb_to_recordset(p_items) as x(product_id uuid, quantity numeric)
    on x.product_id = p.id
  order by p.id
  for update of p;

  perform s.id
  from public.stores s
  join public.products p on p.store_id = s.id
  join jsonb_to_recordset(p_items) as x(product_id uuid, quantity numeric)
    on x.product_id = p.id
  order by s.id
  for update of s;

  perform d.id
  from public.store_delivery_settings d
  join public.products p on p.store_id = d.store_id
  join jsonb_to_recordset(p_items) as x(product_id uuid, quantity numeric)
    on x.product_id = p.id
  order by d.store_id
  for update of d;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity numeric)
    left join public.products p on p.id = x.product_id
    left join public.stores s on s.id = p.store_id
    left join public.store_delivery_settings d on d.store_id = p.store_id
    where p.id is null
       or p.status <> 'published'
       or s.status <> 'active'
       or d.is_enabled is distinct from true
       or (p.stock_quantity is not null and p.stock_quantity < x.quantity)
  ) then
    raise exception 'One or more products are unavailable, out of stock, or have no configured delivery fee.'
      using errcode = '23514';
  end if;

  -- Each merchant store gets a separate COD order and delivery charge.
  -- All orders from one cart are committed in this single database transaction.
  for v_store in
    select distinct p.store_id, d.delivery_fee_iqd
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity numeric)
    join public.products p on p.id = x.product_id
    join public.store_delivery_settings d on d.store_id = p.store_id
    order by p.store_id
  loop
    select coalesce(sum(round(p.price_iqd::numeric * x.quantity)), 0)::bigint
    into v_subtotal
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity numeric)
    join public.products p on p.id = x.product_id
    where p.store_id = v_store.store_id;

    v_total := v_subtotal + v_store.delivery_fee_iqd;

    insert into public.orders (
      checkout_group_id,
      checkout_request_id,
      customer_id,
      store_id,
      status,
      payment_method,
      payment_status,
      customer_name,
      customer_phone,
      delivery_address,
      delivery_note,
      subtotal_iqd,
      delivery_fee_iqd,
      total_iqd
    )
    values (
      v_checkout_group,
      p_checkout_request_id,
      v_customer,
      v_store.store_id,
      'placed',
      'cash_on_delivery',
      'unpaid',
      btrim(p_customer_name),
      btrim(p_customer_phone),
      btrim(p_delivery_address),
      nullif(btrim(coalesce(p_delivery_note, '')), ''),
      v_subtotal,
      v_store.delivery_fee_iqd,
      v_total
    )
    returning id, order_number into v_order_id, v_order_number;

    insert into public.order_items (
      order_id,
      product_id,
      product_name,
      unit_label,
      unit_price_iqd,
      quantity,
      line_total_iqd,
      image_path
    )
    select
      v_order_id,
      p.id,
      p.name,
      p.unit_label,
      p.price_iqd,
      x.quantity,
      round(p.price_iqd::numeric * x.quantity)::bigint,
      p.image_path
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity numeric)
    join public.products p on p.id = x.product_id
    where p.store_id = v_store.store_id;

    update public.products p
    set stock_quantity = p.stock_quantity - x.quantity
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity numeric)
    where p.id = x.product_id
      and p.store_id = v_store.store_id
      and p.stock_quantity is not null;

    v_orders := v_orders || jsonb_build_array(jsonb_build_object(
      'order_id', v_order_id,
      'order_number', v_order_number,
      'store_id', v_store.store_id,
      'subtotal_iqd', v_subtotal,
      'delivery_fee_iqd', v_store.delivery_fee_iqd,
      'total_iqd', v_total
    ));
    v_order_count := v_order_count + 1;
  end loop;

  if v_order_count = 0 then
    raise exception 'No eligible store could accept this checkout.'
      using errcode = '23514';
  end if;

  return jsonb_build_object(
    'checkout_group_id', v_checkout_group,
    'order_count', v_order_count,
    'orders', v_orders
  );
end;
$$;

create or replace function public.cancel_cod_order(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer uuid := auth.uid();
  v_order public.orders%rowtype;
  v_item record;
begin
  if v_customer is null then
    raise exception 'Authentication is required.'
      using errcode = '28000';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
    and customer_id = v_customer
  for update;

  if not found then
    raise exception 'Order not found.'
      using errcode = 'P0002';
  end if;

  if v_order.status <> 'placed' or v_order.payment_status <> 'unpaid' then
    raise exception 'Only unpaid orders that have not yet been accepted can be cancelled by the customer.'
      using errcode = '55000';
  end if;

  for v_item in
    select product_id, quantity
    from public.order_items
    where order_id = v_order.id
    order by product_id
  loop
    update public.products
    set stock_quantity = stock_quantity + v_item.quantity
    where id = v_item.product_id
      and stock_quantity is not null;
  end loop;

  update public.orders
  set status = 'cancelled'
  where id = v_order.id;

  return v_order.id;
end;
$$;

revoke all on function public.set_store_delivery_fee(uuid, bigint, boolean)
  from public, anon, authenticated;
revoke all on function public.create_cod_checkout(uuid, jsonb, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.cancel_cod_order(uuid)
  from public, anon, authenticated;

grant execute on function public.set_store_delivery_fee(uuid, bigint, boolean)
  to authenticated;
grant execute on function public.create_cod_checkout(uuid, jsonb, text, text, text, text)
  to authenticated;
grant execute on function public.cancel_cod_order(uuid)
  to authenticated;

comment on table public.orders is
  'One order per merchant store from a cart checkout. COD is the only accepted payment method in M06.';
comment on table public.order_items is
  'Immutable item price and product snapshots at checkout; order history is not recalculated from current catalog prices.';
comment on table public.store_delivery_settings is
  'Super Admin controlled per-store delivery fee configuration. Checkout is blocked until an active fee is configured.';
comment on function public.create_cod_checkout(uuid, jsonb, text, text, text, text) is
  'Validates current published product prices, store delivery configuration and stock in one transaction; creates one COD order per store and decrements tracked stock atomically.';
comment on function public.cancel_cod_order(uuid) is
  'Allows a customer to cancel only their own unpaid placed order and restores tracked stock in the same transaction.';
