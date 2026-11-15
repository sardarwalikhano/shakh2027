import Link from "next/link";
import { getMessages } from "@/lib/i18n/locale";

export default async function OfflinePage() {
  const { messages: t } = await getMessages();
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <span className="brand-mark">ش</span>
        <h1 className="auth-title">{t.offlineTitle}</h1>
        <p className="auth-description">{t.offlineDescription}</p>
        <Link className="primary-action" href="/">{t.retry} <span>↻</span></Link>
      </section>
    </main>
  );
}
