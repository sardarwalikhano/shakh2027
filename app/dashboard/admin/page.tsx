import { requireAnyRole } from "@/lib/auth/context";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireAnyRole(["super_admin"]);

  return (
    <main className="dashboard-page">
      <section className="dashboard-welcome">
        <span className="eyebrow"><i /> Super Admin</span>
        <h1>ناوەندی <em>بەڕێوەبردنی شاخ</em></h1>
        <p>بەڕێوەبردنی هەژمار، فرۆشگا، پۆست، ئۆردەر، Wallet و ڕاپۆرتەکان.</p>
        <div className="account-card">
          <strong>فرۆشگای تایبەتی SHAKH STORE</strong>
          <span>پۆستکردنی بەرهەم لە هەموو پۆلەکاندا تەنها لە خاوەندارێتی فرۆشگای پلاتفۆرمدا دەبێت.</span>
        </div>
      </section>
    </main>
  );
}
