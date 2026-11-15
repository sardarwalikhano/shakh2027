import { requireAnyRole } from "@/lib/auth/context";

export const dynamic = "force-dynamic";

export default async function CaptainDashboardPage() {
  await requireAnyRole(["captain"]);

  return (
    <main className="dashboard-page">
      <section className="dashboard-welcome">
        <span className="eyebrow"><i /> ناوچەی کاپتن</span>
        <h1>داواکاری و <em>گەیاندن</em></h1>
        <p>وەرگرتنی ئۆردەر و بەڕێوەبردنی گەیاندنەکان لە ناو سیستەمەوە ئەنجام دەدرێت.</p>
        <div className="account-card">
          <span>Commission ـی کاپتن</span>
          <strong>20%</strong>
          <span>پارەی گەیاندن</span>
          <strong>100% بە کاش لە کڕیار وەردەگیرێت؛ 20% لە Wallet ـی پێشوەختەی کاپتن دەدرێت.</strong>
        </div>
      </section>
    </main>
  );
}
