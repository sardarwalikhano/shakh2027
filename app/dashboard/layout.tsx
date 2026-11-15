import Link from "next/link";
import { requireAuthContext } from "@/lib/auth/context";
import { getMessages } from "@/lib/i18n/locale";
import { signOut } from "./actions";
import type { AppRole } from "@/lib/domain/roles";

export const dynamic = "force-dynamic";

type NavItem = { href: string; label: string };

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [context, { messages: t }] = await Promise.all([
    requireAuthContext(),
    getMessages(),
  ]);

  const items: NavItem[] = [
    { href: "/dashboard", label: t.dashboardEyebrow },
  ];
  const roles = new Set<AppRole>(context.roles);

  if (roles.has("super_admin")) {
    items.push(
      { href: "/dashboard/admin", label: t.adminTitle },
      { href: "/dashboard/admin/stores", label: t.adminStoresLink },
    );
  }

  if (
    roles.has("restaurant")
    || roles.has("supermarket")
    || roles.has("meat_seafood_vendor")
    || roles.has("baqal")
  ) {
    items.push(
      { href: "/dashboard/merchant", label: t.merchantTitle },
      { href: "/dashboard/merchant/store", label: t.merchantStoreLink },
    );
  }

  if (roles.has("captain")) {
    items.push({ href: "/dashboard/captain", label: t.captainTitle });
  }

  if (roles.has("customer")) {
    items.push({ href: "/dashboard/customer", label: t.customerTitle });
  }

  return (
    <div className="dashboard-shell">
      <header className="dashboard-shell-header">
        <div className="dashboard-shell-topbar">
          <Link className="brand" href="/" aria-label="SHAKH STORE">
            <span className="brand-mark">ش</span>
            <span><strong>SHAKH</strong><small>STORE</small></span>
          </Link>
          <div className="dashboard-shell-account">
            <span dir="ltr">{context.email ?? context.userId}</span>
            <form action={signOut}>
              <button className="signout-button" type="submit">{t.signOut}</button>
            </form>
          </div>
        </div>
        <nav className="dashboard-shell-nav" aria-label={t.dashboardEyebrow}>
          {items.map((item) => (
            <Link href={item.href} key={item.href}>{item.label}</Link>
          ))}
        </nav>
      </header>
      <div className="dashboard-shell-content">{children}</div>
    </div>
  );
}
