import Link from "next/link";
import { requireAnyRole } from "@/lib/auth/context";
import { getMessages } from "@/lib/i18n/locale";

export const dynamic = "force-dynamic";

export default async function MerchantDashboardPage() {
  const context = await requireAnyRole(["restaurant", "supermarket", "meat_seafood_vendor", "baqal"]);
  const { messages: t } = await getMessages();

  return (
    <main className="dashboard-page">
      <section className="dashboard-welcome">
        <span className="eyebrow"><i /> {t.merchantEyebrow}</span>
        <h1>{t.merchantTitle}</h1>
        <p>{t.merchantDescription}</p>
        <div className="account-card">
          <span>{t.activeRoles}</span>
          <strong>{context.roles.map((role) => t.roleLabels[role]).join("، ")}</strong>
          <span>{t.merchantAccess}</span>
        </div>
        <div className="dashboard-action-grid">
          <Link className="dashboard-action-card" href="/dashboard/merchant/store">
            <strong>{t.merchantStoreLink}</strong>
            <span>{t.storePageDescription}</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
