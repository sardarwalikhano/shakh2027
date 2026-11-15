-- SHAKH STORE security follow-up: enforce active store ownership + merchant role in reads.
-- Also remove client EXECUTE access from the internal Supabase RLS event-trigger handler.
-- Applies after M05, M06 and M07; additive policy/grant hardening only.

drop policy wallets_owner_or_admin_read on public.wallets;
create policy wallets_owner_or_admin_read
on public.wallets
for select
to authenticated
using (
  (select private.is_super_admin())
  or (
    wallet_type = 'merchant'
    and exists (
      select 1 from public.stores s
      where s.id = wallets.store_id
        and (select private.can_manage_store(s.id))
    )
  )
  or (wallet_type in ('captain', 'customer') and user_id = (select auth.uid()))
);

drop policy wallet_ledger_owner_or_admin_read on public.wallet_ledger;
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
    where w.id = wallet_ledger.wallet_id
      and (
        (w.wallet_type = 'merchant' and s.id is not null and (select private.can_manage_store(s.id)))
        or (w.wallet_type in ('captain', 'customer') and w.user_id = (select auth.uid()))
      )
  )
);

drop policy promotion_reservations_owner_or_admin_read on public.promotion_budget_reservations;
create policy promotion_reservations_owner_or_admin_read
on public.promotion_budget_reservations
for select
to authenticated
using (
  (select private.is_super_admin())
  or exists (
    select 1
    from public.wallets w
    join public.stores s on s.id = w.store_id
    where w.id = promotion_budget_reservations.wallet_id
      and w.wallet_type = 'merchant'
      and (select private.can_manage_store(s.id))
  )
);

drop policy orders_customer_merchant_admin_read on public.orders;
create policy orders_customer_merchant_admin_read
on public.orders
for select
to authenticated
using (
  customer_id = (select auth.uid())
  or (select private.is_super_admin())
  or exists (
    select 1 from public.stores s
    where s.id = orders.store_id
      and (select private.can_manage_store(s.id))
  )
);

drop policy order_items_visible_with_order on public.order_items;
create policy order_items_visible_with_order
on public.order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and (
        o.customer_id = (select auth.uid())
        or (select private.is_super_admin())
        or exists (
          select 1 from public.stores s
          where s.id = o.store_id
            and (select private.can_manage_store(s.id))
        )
      )
  )
);

-- Internal DDL event-trigger handler; it is not an exposed RPC endpoint.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
