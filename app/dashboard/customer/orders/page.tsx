import { requireAnyRole, requireAuthContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { getMessages } from "@/lib/i18n/locale";
import { cancelCustomerOrder } from "./actions";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ error?: string; success?: string }> };
type OrderItem = {
  id: string;
  product_name: string;
  unit_label: string;
  unit_price_iqd: number | string;
  quantity: number | string;
  line_total_iqd: number | string;
};
type OrderRow = {
  id: string;
  order_number: string;
  store_id: string;
  status: "placed" | "accepted" | "preparing" | "ready_for_pickup" | "assigned" | "picked_up" | "delivered" | "cancelled";
  payment_status: "unpaid" | "paid" | "refunded";
  payment_method: "cash_on_delivery";
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
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
  to_status: OrderRow["status"];
  actor_role: keyof Awaited<ReturnType<typeof getMessages>>["messages"]["roleLabels"];
  reason: string | null;
  created_at: string;
};

function formatIqd(value: number | string, locale: string) {
  return `${Number(value).toLocaleString(locale === "ku" ? "ku-IQ" : locale === "ar" ? "ar-IQ" : "en-IQ")} IQD`;
}

export default async function CustomerOrdersPage({ searchParams }: Props) {
  await requireAnyRole(["customer"]);
  const context = await requireAuthContext();
  const [{ messages: t, locale }, params, supabase] = await Promise.all([
    getMessages(),
    searchParams,
    createClient(),
  ]);

  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, store_id, status, payment_status, payment_method, customer_name, customer_phone, delivery_address, subtotal_iqd, delivery_fee_iqd, total_iqd, created_at, stores(name), order_items(id, product_name, unit_label, unit_price_iqd, quantity, line_total_iqd)")
    .eq("customer_id", context.userId)
    .order("created_at", { ascending: false })
    .limit(100);

  const missingSchema = Boolean(error && (
    error.code === "PGRST205"
    || error.code === "42P01"
    || /public\.orders|schema cache|does not exist/i.test(error.message)
  ));
  const orders = (data ?? []) as unknown as OrderRow[];
  let statusEvents: StatusEvent[] = [];
  if (!missingSchema && orders.length > 0) {
    const eventResult = await supabase
      .from("order_status_events")
      .select("id, order_id, to_status, actor_role, reason, created_at")
      .in("order_id", orders.map((order) => order.id))
      .order("created_at", { ascending: true });
    if (!eventResult.error) statusEvents = (eventResult.data ?? []) as StatusEvent[];
  }

  const eventsByOrder = new Map<string, StatusEvent[]>();
  for (const event of statusEvents) {
    const existing = eventsByOrder.get(event.order_id) ?? [];
    existing.push(event);
    eventsByOrder.set(event.order_id, existing);
  }

  const errorText = missingSchema || params.error === "migration"
    ? t.checkoutSchemaMissing
    : params.error === "unavailable" ? t.orderCancelUnavailable
    : params.error === "config" ? t.checkoutConfigError
    : params.error ? t.checkoutFailed
    : null;

  const statusLabels: Record<OrderRow["status"], string> = {
    placed: t.orderPlaced,
    accepted: t.orderAccepted,
    preparing: t.orderPreparing,
    ready_for_pickup: t.orderReady,
    assigned: t.orderAssigned,
    picked_up: t.orderPickedUp,
    delivered: t.orderDelivered,
    cancelled: t.orderCancelled,
  };

  return (
    <main className="dashboard-page customer-orders-page">
      <section className="dashboard-section">
        <span className="eyebrow"><i /> {t.customerEyebrow}</span>
        <h1 className="section-title">{t.customerOrdersTitle}</h1>
        {params.success === "cancelled" && <p className="form-success" role="status">{t.orderCancelSuccess}</p>}
        {errorText && <p className="form-error" role="alert">{errorText}</p>}

        {!missingSchema && orders.length === 0 ? (
          <p className="empty-state">{t.customerOrdersEmpty}</p>
        ) : (
          <div className="customer-order-list">
            {orders.map((order) => (
              <article className="customer-order-card" key={order.id}>
                <header className="customer-order-heading">
                  <div>
                    <span className="store-type-label">{order.order_number}</span>
                    <h2>{order.stores?.name ?? "SHAKH STORE"}</h2>
                  </div>
                  <span className={`store-status store-status-${order.status === "placed" ? "pending" : order.status === "cancelled" ? "rejected" : "active"}`}>
                    {statusLabels[order.status]}
                  </span>
                </header>
                <p className="customer-order-meta">
                  {new Date(order.created_at).toLocaleString(locale === "ku" ? "ku-IQ" : locale === "ar" ? "ar-IQ" : "en-IQ", { timeZone: "Asia/Baghdad" })}
                  · {t.checkoutCodOnly}
                </p>
                {(eventsByOrder.get(order.id)?.length ?? 0) > 0 && (
                  <div className="customer-order-meta">
                    <strong>{t.orderStatusHistory}</strong>
                    {eventsByOrder.get(order.id)?.map((event) => (
                      <p key={event.id}>
                        {statusLabels[event.to_status]} · {new Date(event.created_at).toLocaleString(
                          locale === "ku" ? "ku-IQ" : locale === "ar" ? "ar-IQ" : "en-IQ",
                          { timeZone: "Asia/Baghdad" },
                        )}
                        {" — "}{t.roleLabels[event.actor_role]}
                        {event.reason ? " · " + event.reason : ""}
                      </p>
                    ))}
                  </div>
                )}
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
                <p className="customer-order-address">{t.deliveryAddress}: {order.delivery_address}</p>
                {order.status === "placed" && order.payment_status === "unpaid" && (
                  <form action={cancelCustomerOrder}>
                    <input type="hidden" name="orderId" value={order.id} />
                    <button className="review-reject" type="submit">{t.orderCancel}</button>
                  </form>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
