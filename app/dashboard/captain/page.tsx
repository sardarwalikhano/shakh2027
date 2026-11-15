import { requireAnyRole } from "@/lib/auth/context";
import { getMessages } from "@/lib/i18n/locale";

export const dynamic = "force-dynamic";

export default async function CaptainDashboardPage() {
  await requireAnyRole(["captain"]);
  const { messages: t } = await getMessages();

  return (
    <main className="dashboard-page">
      <section className="dashboard-welcome">
        <span className="eyebrow"><i /> {t.captainEyebrow}</span>
        <h1>{t.captainTitle}</h1>
        <p>{t.captainDescription}</p>
        <div className="account-card">
          <span>{t.captainCommission}</span>
          <strong>20%</strong>
          <span>{t.deliveryFee}</span>
          <strong>{t.captainCommissionDescription}</strong>
        </div>
      </section>
    </main>
  );
}
