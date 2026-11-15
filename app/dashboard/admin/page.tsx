import { requireAnyRole } from "@/lib/auth/context";
import { getMessages } from "@/lib/i18n/locale";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireAnyRole(["super_admin"]);
  const { messages: t } = await getMessages();

  return (
    <main className="dashboard-page">
      <section className="dashboard-welcome">
        <span className="eyebrow"><i /> Super Admin</span>
        <h1>{t.adminTitle}</h1>
        <p>{t.adminDescription}</p>
        <div className="account-card">
          <strong>{t.platformStore}</strong>
          <span>{t.platformStoreDescription}</span>
        </div>
      </section>
    </main>
  );
}
