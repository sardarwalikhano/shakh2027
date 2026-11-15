import { requireAnyRole } from "@/lib/auth/context";

export const dynamic = "force-dynamic";

export default async function MerchantDashboardPage() {
  const context = await requireAnyRole(["restaurant", "supermarket", "meat_seafood_vendor", "baqal"]);

  return (
    <main className="dashboard-page">
      <section className="dashboard-welcome">
        <span className="eyebrow"><i /> ناوچەی فرۆشیار</span>
        <h1>بەڕێوەبردنی <em>فرۆشگا</em></h1>
        <p>هەژمارەکەت بە ڕۆڵی فرۆشیار پشتڕاست کراوەتەوە.</p>
        <div className="account-card">
          <span>ڕۆڵەکەت</span>
          <strong>{context.roles.join("، ")}</strong>
          <span>سنووری دەستڕاگەیشتن</span>
          <strong>تەنها فرۆشگا و پۆلی پەسەندکراوی خۆت</strong>
        </div>
      </section>
    </main>
  );
}
