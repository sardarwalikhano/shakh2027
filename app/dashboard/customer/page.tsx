import Link from "next/link";
import { requireAnyRole } from "@/lib/auth/context";
import { getMessages } from "@/lib/i18n/locale";

export const dynamic = "force-dynamic";

export default async function CustomerDashboardPage() {
  await requireAnyRole(["customer"]);
  const { messages: t } = await getMessages();

  return (
    <main className="dashboard-page">
      <section className="dashboard-welcome">
        <span className="eyebrow"><i /> {t.customerEyebrow}</span>
        <h1>{t.customerTitle}</h1>
        <p>{t.customerDescription}</p>
        <div className="account-card">
          <span>{t.orderPayment}</span>
          <strong>{t.cashOnDelivery}</strong>
          <span>{t.rewardReferral}</span>
          <strong>{t.rewardDescription}</strong>
        </div>
        <div className="dashboard-action-grid">
          <Link className="dashboard-action-card" href="/catalog">
            <strong>{t.productPublicCatalog}</strong>
            <span>{t.productCatalogDescription}</span>
          </Link>
          <Link className="dashboard-action-card" href="/cart">
            <strong>{t.cartTitle}</strong>
            <span>{t.cartDescription}</span>
          </Link>
          <Link className="dashboard-action-card" href="/dashboard/customer/orders">
            <strong>{t.customerOrdersLink}</strong>
            <span>{t.customerOrdersTitle}</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
