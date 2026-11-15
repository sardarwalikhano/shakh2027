import Link from "next/link";
import { redirect } from "next/navigation";
import { ROLE_DEFAULT_PATH } from "@/lib/domain/roles";
import { getAuthContext } from "@/lib/auth/context";
import { getMessages } from "@/lib/i18n/locale";
import { signOut } from "./actions";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const context = await getAuthContext();
  if (!context) redirect("/login");
  const { messages: t } = await getMessages();

  const primaryRole = context.roles[0];
  const roleDestination = primaryRole ? ROLE_DEFAULT_PATH[primaryRole] : null;

  return (
    <main className="dashboard-page">
      <header className="dashboard-topbar">
        <Link className="brand" href="/">
          <span className="brand-mark">ش</span>
          <span><strong>SHAKH</strong><small>STORE</small></span>
        </Link>
        <form action={signOut}><button className="signout-button" type="submit">{t.login === "Sign in" ? "Sign out" : t.login === "تسجيل الدخول" ? "تسجيل الخروج" : "چوونەدەرەوە"}</button></form>
      </header>
      <section className="dashboard-welcome">
        <span className="eyebrow"><i /> {t.dashboardEyebrow}</span>
        <h1>{t.dashboardWelcome} {context.fullName ?? ""} <em>SHAKH STORE</em></h1>
        <p>{context.email ?? context.userId}</p>
        <div className="account-card">
          <span>{t.currentAccount}</span>
          <strong dir="ltr">{context.email ?? context.userId}</strong>
          <span>{t.activeRoles}</span>
          <strong>{context.roles.length ? context.roles.map((role) => t.roleLabels[role]).join("، ") : t.noRoles}</strong>
        </div>
        {roleDestination ? (
          <Link className="primary-action" href={roleDestination}>{t.dashboardWelcome} <span>←</span></Link>
        ) : (
          <p className="setup-note">{t.noRoleNotice}</p>
        )}
      </section>
    </main>
  );
}
