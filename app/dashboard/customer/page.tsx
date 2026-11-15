import { requireAnyRole } from "@/lib/auth/context";

export const dynamic = "force-dynamic";

export default async function CustomerDashboardPage() {
  await requireAnyRole(["customer"]);

  return (
    <main className="dashboard-page">
      <section className="dashboard-welcome">
        <span className="eyebrow"><i /> ناوچەی کڕیار</span>
        <h1>بەخێربێیت بۆ <em>بازاڕ</em></h1>
        <p>بەڕێوەبردنی ئۆردەر، بەدواداچوونی گەیاندن و بەڕێوەبردنی خەڵاتەکان.</p>
        <div className="account-card">
          <span>پارەدانی ئۆردەر</span>
          <strong>Cash on Delivery</strong>
          <span>خەڵات و Referral</span>
          <strong>خەڵات تەنها دوای تەواوبوونی فرۆشتنی گونجاو هەژمار دەکرێت.</strong>
        </div>
      </section>
    </main>
  );
}
