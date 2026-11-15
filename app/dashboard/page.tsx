import Link from "next/link";
import { redirect } from "next/navigation";
import { ROLE_DEFAULT_PATH, ROLE_LABELS } from "@/lib/domain/roles";
import { getAuthContext } from "@/lib/auth/context";
import { signOut } from "./actions";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const context = await getAuthContext();
  if (!context) redirect("/login");

  const primaryRole = context.roles[0];
  const roleDestination = primaryRole ? ROLE_DEFAULT_PATH[primaryRole] : null;

  return (
    <main className="dashboard-page">
      <header className="dashboard-topbar">
        <Link className="brand" href="/">
          <span className="brand-mark">ش</span>
          <span><strong>SHAKH</strong><small>STORE</small></span>
        </Link>
        <form action={signOut}><button className="signout-button" type="submit">چوونەدەرەوە</button></form>
      </header>
      <section className="dashboard-welcome">
        <span className="eyebrow"><i /> ناوچەی پارێزراوی بەکارهێنەر</span>
        <h1>بەخێربێیت {context.fullName ?? "بۆ"} <em>SHAKH STORE</em></h1>
        <p>هەژمارەکەت بە سەرکەوتوویی پشتڕاست کرایەوە.</p>
        <div className="account-card">
          <span>هەژماری ئێستا</span>
          <strong dir="ltr">{context.email ?? context.userId}</strong>
          <span>ڕۆڵە چالاکەکان</span>
          <strong>{context.roles.length ? context.roles.map((role) => ROLE_LABELS[role]).join("، ") : "چاوەڕێی دیاریکردنی ڕۆڵ"}</strong>
        </div>
        {roleDestination ? (
          <Link className="primary-action" href={roleDestination}>چوونە ناو داشبۆرد <span>←</span></Link>
        ) : (
          <p className="setup-note">هەژمارەکەت چالاکە، بەڵام هیچ ڕۆڵێکی بازرگانی بۆی تۆمار نەکراوە. ڕۆڵەکان لەلایەن سیستەمەوە دیاری دەکرێن؛ خۆت ناتوانیت خۆت بکەیتە بەڕێوەبەری گشتی یان فرۆشیار.</p>
        )}
      </section>
    </main>
  );
}
