import { requireAnyRole } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { getMessages } from "@/lib/i18n/locale";
import { transitionMerchantOrder } from "./actions";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ error?: string; success?: string }> };
type OrderStatus =
  | "placed"
  | "accepted"
  | "preparing"
  | "ready_for_pickup"
  | "assigned"
  | "picked_up"
  | "delivered"
  | "cancelled";

type OrderItem = {
  id: string;
  product_name: string;
  unit_label: string;
  quantity: number | string;
  line_total_iqd: number | string;
};

type OrderRow = {
  id: string;
  order_number: string;
  store_id: string;
  status: OrderStatus;
  payment_status: "unpaid" | "paid" | "refunded";
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  delivery_note: string | null;
  subtotal_iqd: number | string;
  delivery_fee_iqd: number | string;
  total_iqd: number | string;
  created_at: string;
  stores: { name: string } | null;
  order_items: OrderItem[];
};

type StatusEvent = {
  id: string;
  order_id: string;
  to_status: OrderStatus;
  actor_role: keyof Awaited<ReturnType<typeof getMessages>>["messages"]["roleLabels"];
  reason: string | null;
  created_at: string;
};

const MERCHANT_ROLES = [
  "restaurant",
  "supermarket",
  "meat_seafood_vendor",
  "baqal",
] as const;

function formatIqd(value: number | string, locale: string) {
  const language = locale === "ku" ? "ku-IQ" : locale === "ar" ? "ar-IQ" : "en-IQ";
  return Number(value).toLocaleString(language) + " IQD";
}

function formatDate(value: string, locale: string) {
  const language = locale === "ku" ? "ku-IQ" : locale === "ar" ? "ar-IQ" : "en-IQ";
  return new Date(value).toLocaleString(language, { timeZone: "Asia/Baghdad" });
}

export default async function MerchantOrdersPage({ searchParams }: Props) {
  const context = await requireAnyRole(MERCHANT_ROLES);
  const [{ messages: t, locale }, params, supabase] = await Promise.all([
    getMessages(),
    searchParams,
    createClient(),
  ]);

  const { data: storeRows, error: storesError } = await supabase
    .from("stores")
    .select("id, name")
    .eq("owner_id", context.userId)
    .order("created_at", { ascending: true });

  const stores = storeRows ?? [];
  const storeIds = stores.map((store) => store.id);
  let orders: OrderRow[] = [];
  let ordersError: { code?: string; message: string } | null = storesError;
  let events: StatusEvent[] = [];

  if (storeIds.length > 0 && !storesError) {
    const result = await supabase
      .from("orders")
      .select("id, order_number, store_id, status, payment_status, customer_name, customer_phone, delivery_address, delivery_note, subtotal_iqd, delivery_fee_iqd, total_iqd, created_at, stores(name), order_items(id, product_name, unit_label, quantity, line_total_iqd)")
      .in("store_id", storeIds)
      .order("created_at", { ascending: false })
      .limit(100);

    ordersError = result.error;
    orders = (result.data ?? []) as unknown as OrderRow[];

    if (orders.length > 0) {
      const history = await supabase
        .from("order_status_events")
        .select("id, order_id, to_status, actor_role, reason, created_at")
        .in("order_id", orders.map((order) => order.id))
        .order("created_at", { ascending: true });
      if (!history.error) events = (history.data ?? []) as StatusEvent[];
    }
  }

  const missingSchema = Boolean(ordersError && (
    ordersError.code === "PGRST205"
    || ordersError.code === "42P01"
    || /schema cache|does not exist/i.test(ordersError.message)
  ));

  const errorText = missingSchema || params.error === "migration"
    ? t.orderModuleMissing
    : params.error === "forbidden" ? t.orderTransitionForbidden
    : params.error === "unavailable" ? t.orderTransitionUnavailable
    : params.error === "conflict" ? t.orderTransitionConflict
    : params.error === "config" ? t.checkoutConfigError
    : params.error ? t.orderTransitionFailed
    : null;

  const successText = params.success === "cancelled"
    ? t.orderMerchantCancelled
    : params.success === "status" ? t.orderStatusUpdated
    : null;

  const statusLabels: Record<OrderStatus, string> = {
    placed: t.orderPlaced,
    accepted: t.orderAccepted,
    preparing: t.orderPreparing,
    ready_for_pickup: t.orderReady,
    assigned: t.orderAssigned,
    picked_up: t.orderPickedUp,
    delivered: t.orderDelivered,
    cancelled: t.orderCancelled,
  };

  const eventsByOrder = new Map<string, StatusEvent[]>();
  for (const event of events) {
    const group = eventsByOrder.get(event.order_id) ?? [];
    group.push(event);
    eventsByOrder.set(event.order_id, group);
  }

  return (
    <main className="dashboard-page customer-orders-page">
      <section className="dashboard-section">
        <span className="eyebrow"><i /> {t.merchantTitle}</span>
        <h1 className="section-title">{t.orderManagementTitle}</h1>
        <p className="section-description">{t.orderManagementIntro}</p>

        {successText && <p className="form-success" role="status">{successText}</p>}
        {errorText && <p className="form-error" role="alert">{errorText}</p>}

        {!missingSchema && !storesError && orders.length === 0 && (
          <p className="empty-state">{t.orderMerchantEmpty}</p>
        )}

        {!missingSchema && storesError && (
          <p className="form-error" role="alert">{t.orderModuleMissing}</p>
        )}

        {orders.map((order) => {
          const nextAction = order.status === "placed"
            ? { status: "accepted", label: t.orderAcceptAction }
            : order.status === "accepted"
              ? { status: "preparing", label: t.orderStartPreparing }
              : order.status === "preparing"
                ? { status: "ready_for_pickup", label: t.orderReadyAction }
                : null;

          const canCancel = ["placed", "accepted", "preparing", "ready_for_pickup"].includes(order.status);
          const history = eventsByOrder.get(order.id) ?? [];

          return (
            <article className="customer-order-card" key={order.id}>
              <header className="customer-order-heading">
                <div>
                  <span className="store-type-label">{order.order_number}</span>
                  <h2>{order.stores?.name ?? t.merchantTitle}</h2>
                </div>
                <span className={"store-status store-status-" + (order.status === "placed" ? "pending" : order.status === "cancelled" ? "rejected" : "active")}>
                  {statusLabels[order.status]}
                </span>
              </header>

              <p className="customer-order-meta">
                {formatDate(order.created_at, locale)} · {t.orderCustomer}: {order.customer_name}
              </p>
              <p className="customer-order-meta" dir="ltr">{order.customer_phone}</p>
              <p className="customer-order-address">{t.deliveryAddress}: {order.delivery_address}</p>
              {order.delivery_note && <p className="customer-order-address">{t.orderCustomerNote}: {order.delivery_note}</p>}

              <div className="customer-order-items">
                {order.order_items.map((item) => (
                  <div key={item.id}>
                    <span>{item.product_name} · {item.quantity} {item.unit_label}</span>
                    <strong>{formatIqd(item.line_total_iqd, locale)}</strong>
                  </div>
                ))}
              </div>

              <div className="customer-order-totals">
                <div><span>{t.cartSubtotal}</span><strong>{formatIqd(order.subtotal_iqd, locale)}</strong></div>
                <div><span>{t.deliveryFee}</span><strong>{formatIqd(order.delivery_fee_iqd, locale)}</strong></div>
                <div className="customer-order-grand-total"><span>{t.orderTotal}</span><strong>{formatIqd(order.total_iqd, locale)}</strong></div>
              </div>

              {history.length > 0 && (
                <div className="customer-order-meta">
                  <strong>{t.orderStatusHistory}</strong>
                  {history.map((event) => (
                    <p key={event.id}>
                      {statusLabels[event.to_status]} · {formatDate(event.created_at, locale)}
                      {" — "}{t.roleLabels[event.actor_role]}
                      {event.reason ? " · " + event.reason : ""}
                    </p>
                  ))}
                </div>
              )}

              <div className="post-card-actions">
                {nextAction && (
                  <form action={transitionMerchantOrder}>
                    <input type="hidden" name="orderId" value={order.id} />
                    <input type="hidden" name="nextStatus" value={nextAction.status} />
                    <input type="hidden" name="idempotencyKey" value={"merchant-order-" + crypto.randomUUID()} />
                    <button className="secondary-action" type="submit">{nextAction.label}</button>
                  </form>
                )}

                {canCancel && (
                  <form action={transitionMerchantOrder}>
                    <input type="hidden" name="orderId" value={order.id} />
                    <input type="hidden" name="nextStatus" value="cancelled" />
                    <input type="hidden" name="idempotencyKey" value={"merchant-order-" + crypto.randomUUID()} />
                    <label>
                      {t.orderCancelReason}
                      <textarea name="reason" rows={2} minLength={3} maxLength={500} required />
                    </label>
                    <button className="review-reject" type="submit">{t.orderMerchantReject}</button>
                  </form>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
