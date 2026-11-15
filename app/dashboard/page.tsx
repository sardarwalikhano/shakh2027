import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/login");
  }

  const email = typeof data.claims.email === "string" ? data.claims.email : "هەژماری بەکارهێنەر";

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
        <h1>بەخێربێیت بۆ <em>SHAKH STORE</em></h1>
        <p>هەژمارەکەت بە سەرکەوتوویی پشتڕاست کرایەوە.</p>
        <div className="account-card">
          <span>هەژماری ئێستا</span>
          <strong dir="ltr">{email}</strong>
        </div>
        <p className="setup-note">دیاریکردنی ڕۆڵ و دەسەڵاتەکان لە قۆناغی پەیوەستکردنی Profile و RLS تەواو دەکرێت. تا ئەو کاتە هیچ دەسەڵاتی بازرگانی بە هەژمارێک نادرێت.</p>
      </section>
    </main>
  );
}
