-- SHAKH STORE M07: merchant order lifecycle, immutable status history and safe stock compensation.
-- Depends on M03 stores, M04 products/private.can_manage_store, and M06 orders/order_items.
-- Additive only. Never apply to production before a restorable backup and non-production tests.

create table public.order_status_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  from_status text,
  to_status text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role public.app_role not null,
  reason text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),

  constraint order_status_events_from_status_allowed check (
    from_status is null or from_status in (
      'placed', 'accepted', 'preparing', 'ready_for_pickup',
      'assigned', 'picked_up', 'delivered', 'cancelled'
    )
  ),
  constraint order_status_events_to_status_allowed check (
    to_status in (
      'placed', 'accepted', 'preparing', 'ready_for_pickup',
      'assigned', 'picked_up', 'delivered', 'cancelled'
    )
  ),
  constraint order_status_events_status_changed check (
    from_status is null or from_status <> to_status
  ),
  constraint order_status_events_reason_length check (
    reason is null or char_length(reason) between 3 and 500
  ),
  constraint order_status_events_idempotency_length check (
    char_length(btrim(idempotency_key)) between 12 and 160
  ),
  constraint order_status_events_order_key_unique unique (order_id, idempotency_key)
);

create index order_status_events_order_created_idx
  on public.order_status_events (order_id, created_at, id);

create index order_status_events_actor_created_idx
  on public.order_status_events (actor_user_id, created_at desc);

alter table public.order_status_events enable row level security;

-- Visibility follows the parent order's customer/merchant/Super Admin RLS boundary.
create policy order_status_events_visible_with_order
on public.order_status_events
for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_id
  )
);

revoke all on table public.order_status_events from anon, authenticated;
grant select on table public.order_status_events to authenticated;

create or replace function private.prevent_order_status_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Order status history is immutable.'
    using errcode = '55000';
end;
$$;

revoke all on function private.prevent_order_status_event_mutation()
  from public, anon, authenticated;

create trigger order_status_events_immutable
before update or delete on public.order_status_events
for each row execute function private.prevent_order_status_event_mutation();

-- M06 creates every new order in the placed state. This trigger records the initial
-- event in the same transaction, so no order can be committed without its history row.
create or replace function private.record_order_creation_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.order_status_events (
    order_id,
    from_status,
    to_status,
    actor_user_id,
    actor_role,
    reason,
    idempotency_key,
    created_at
  )
  values (
    new.id,
    null,
    new.status,
    new.customer_id,
    'customer'::public.app_role,
    null,
    'order-created:' || new.id::text,
    new.created_at
  )
  on conflict (order_id, idempotency_key) do nothing;

  return new;
end;
$$;

revoke all on function private.record_order_creation_event()
  from public, anon, authenticated;

create trigger orders_record_creation_event
after insert on public.orders
for each row execute function private.record_order_creation_event();

-- Backfill the initial event for orders created before M07 was deployed.
insert into public.order_status_events (
  order_id,
  from_status,
  to_status,
  actor_user_id,
  actor_role,
  reason,
  idempotency_key,
  created_at
)
select
  o.id,
  null,
  'placed',
  o.customer_id,
  'customer'::public.app_role,
  null,
  'order-created:' || o.id::text,
  o.created_at
from public.orders o
on conflict (order_id, idempotency_key) do nothing;

-- Internal transition worker. It locks the order, validates the actor and transition,
-- restores tracked stock on cancellation, updates status and appends the audit event
-- in one PostgreSQL transaction.
create or replace function private.apply_order_transition(
  p_order_id uuid,
  p_next_status text,
  p_reason text,
  p_idempotency_key text,
  p_actor_role public.app_role
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_existing public.order_status_events%rowtype;
  v_event_id uuid;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_allowed boolean := false;
  v_item record;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.'
      using errcode = '28000';
  end if;

  if p_order_id is null
     or p_next_status is null
     or p_idempotency_key is null
     or char_length(btrim(p_idempotency_key)) not between 12 and 160
     or char_length(coalesce(p_reason, '')) > 500 then
    raise exception 'Order transition input is invalid.'
      using errcode = '22023';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found.'
      using errcode = 'P0002';
  end if;

  if p_actor_role = 'super_admin'::public.app_role then
    if not (select private.is_super_admin()) then
      raise exception 'Super Admin authorization is required.'
        using errcode = '42501';
    end if;

    if p_next_status <> 'cancelled'
       or v_order.status not in ('placed', 'accepted', 'preparing', 'ready_for_pickup') then
      raise exception 'Super Admin may cancel only orders not yet assigned to a captain.'
        using errcode = '55000';
    end if;
  else
    if p_actor_role not in (
      'restaurant'::public.app_role,
      'supermarket'::public.app_role,
      'meat_seafood_vendor'::public.app_role,
      'baqal'::public.app_role
    ) then
      raise exception 'A merchant role is required.'
        using errcode = '42501';
    end if;

    if not (select private.can_manage_store(v_order.store_id)) then
      raise exception 'You cannot manage orders for this store.'
        using errcode = '42501';
    end if;

    if not exists (
      select 1
      from public.user_roles ur
      join public.stores s on s.id = v_order.store_id
      where ur.user_id = (select auth.uid())
        and ur.role = p_actor_role
        and ur.role = case s.store_type
          when 'restaurant' then 'restaurant'::public.app_role
          when 'supermarket' then 'supermarket'::public.app_role
          when 'meat_seafood' then 'meat_seafood_vendor'::public.app_role
          when 'baqal' then 'baqal'::public.app_role
          else null
        end
    ) then
      raise exception 'The account role does not match this merchant store.'
        using errcode = '42501';
    end if;

    v_allowed := (
      (v_order.status = 'placed' and p_next_status in ('accepted', 'cancelled'))
      or (v_order.status = 'accepted' and p_next_status in ('preparing', 'cancelled'))
      or (v_order.status = 'preparing' and p_next_status in ('ready_for_pickup', 'cancelled'))
      or (v_order.status = 'ready_for_pickup' and p_next_status = 'cancelled')
    );

    if not v_allowed then
      raise exception 'This order cannot make the requested status transition.'
        using errcode = '55000';
    end if;
  end if;

  -- Replayed submissions return the original event without repeating stock changes.
  select *
  into v_existing
  from public.order_status_events
  where order_id = p_order_id
    and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.to_status <> p_next_status
       or v_existing.reason is distinct from v_reason
       or v_existing.actor_user_id is distinct from (select auth.uid())
       or v_existing.actor_role <> p_actor_role then
      raise exception 'The idempotency key was already used for a different transition.'
        using errcode = '23505';
    end if;
    return v_existing.id;
  end if;

  if p_next_status = 'cancelled' then
    if v_reason is null or char_length(v_reason) < 3 then
      raise exception 'A cancellation reason of at least 3 characters is required.'
        using errcode = '22023';
    end if;

    -- Lock product rows in stable order before restoring any tracked quantity.
    perform p.id
    from public.products p
    join public.order_items oi on oi.product_id = p.id
    where oi.order_id = p_order_id
      and p.stock_quantity is not null
    order by p.id
    for update of p;

    if exists (
      select 1
      from public.products p
      join public.order_items oi on oi.product_id = p.id
      where oi.order_id = p_order_id
        and p.stock_quantity is not null
        and p.stock_quantity + oi.quantity > 99999999999.999
    ) then
      raise exception 'Restoring this order would exceed the product stock limit. Adjust stock and retry.'
        using errcode = '22003';
    end if;

    update public.products p
    set stock_quantity = p.stock_quantity + oi.quantity
    from public.order_items oi
    where oi.order_id = p_order_id
      and oi.product_id = p.id
      and p.stock_quantity is not null;
  end if;

  update public.orders
  set status = p_next_status
  where id = p_order_id;

  insert into public.order_status_events (
    order_id,
    from_status,
    to_status,
    actor_user_id,
    actor_role,
    reason,
    idempotency_key
  )
  values (
    p_order_id,
    v_order.status,
    p_next_status,
    (select auth.uid()),
    p_actor_role,
    v_reason,
    p_idempotency_key
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

revoke all on function private.apply_order_transition(uuid, text, text, text, public.app_role)
  from public, anon, authenticated;

create or replace function public.merchant_transition_order(
  p_order_id uuid,
  p_next_status text,
  p_reason text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_type text;
  v_actor_role public.app_role;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.'
      using errcode = '28000';
  end if;

  select s.store_type
  into v_store_type
  from public.orders o
  join public.stores s on s.id = o.store_id
  where o.id = p_order_id;

  if not found then
    raise exception 'Order not found.'
      using errcode = 'P0002';
  end if;

  v_actor_role := case v_store_type
    when 'restaurant' then 'restaurant'::public.app_role
    when 'supermarket' then 'supermarket'::public.app_role
    when 'meat_seafood' then 'meat_seafood_vendor'::public.app_role
    when 'baqal' then 'baqal'::public.app_role
    else null
  end;

  if v_actor_role is null then
    raise exception 'This order is not assigned to a merchant-owned store.'
      using errcode = '42501';
  end if;

  return private.apply_order_transition(
    p_order_id,
    p_next_status,
    p_reason,
    p_idempotency_key,
    v_actor_role
  );
end;
$$;

create or replace function public.admin_cancel_order(
  p_order_id uuid,
  p_reason text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.'
      using errcode = '28000';
  end if;

  if not (select private.is_super_admin()) then
    raise exception 'Only Super Admin can cancel orders administratively.'
      using errcode = '42501';
  end if;

  return private.apply_order_transition(
    p_order_id,
    'cancelled',
    p_reason,
    p_idempotency_key,
    'super_admin'::public.app_role
  );
end;
$$;

revoke all on function public.merchant_transition_order(uuid, text, text, text)
  from public, anon, authenticated;
revoke all on function public.admin_cancel_order(uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.merchant_transition_order(uuid, text, text, text)
  to authenticated;
grant execute on function public.admin_cancel_order(uuid, text, text)
  to authenticated;

comment on table public.order_status_events is
  'Append-only order lifecycle audit trail. Event rows are visible only to users who can read the parent order.';
comment on function public.merchant_transition_order(uuid, text, text, text) is
  'Atomically advances a merchant-owned order through placed, accepted, preparing and ready_for_pickup, or cancels before captain assignment; every transition is audited and idempotent.';
comment on function public.admin_cancel_order(uuid, text, text) is
  'Allows Super Admin to cancel an order before captain assignment, restoring tracked stock and appending an immutable audit event in the same transaction.';
