import Link from "next/link";
import { getMessages } from "@/lib/i18n/locale";

export default async function HomePage() {
  const { messages: t, locale } = await getMessages();

  return (
    <main className="landing">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="SHAKH STORE">
          <span className="brand-mark">ش</span>
          <span><strong>SHAKH</strong><small>STORE</small></span>
        </Link>
        <span className="market-label">{t.marketLabel}</span>
      </header>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><i /> {t.homeEyebrow}</span>
          <h1>{t.homeTitle}<br /><em>{t.homeTitleEmphasis}</em></h1>
          <p>{t.homeDescription}</p>
          <div className="hero-actions">
            <Link className="primary-action" href="/login">{t.login} <span>←</span></Link>
            <Link className="secondary-action" href="/signup">{t.signup}</Link>
            <Link className="secondary-action" href="/catalog">{t.productPublicCatalog}</Link>
            <span className="currency-note">{t.currencyNote}</span>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <div className="art-card">
            <span className="art-symbol">ش</span>
            <strong>SHAKH STORE</strong>
            <small>ONE MARKET. MANY POSSIBILITIES.</small>
          </div>
          <span className="art-dot dot-one" /><span className="art-dot dot-two" /><span className="art-dot dot-three" />
        </div>
      </section>
      <section className="highlights" aria-label={t.marketLabel}>
        {t.highlights.map(([title, detail], index) => (
          <article className="highlight" key={title}>
            <span className="highlight-number">{String(index + 1).padStart(2, "0")}</span>
            <div><h2>{title}</h2><p>{detail}</p></div>
            <span className="highlight-arrow">↗</span>
          </article>
        ))}
      </section>
      <footer className="footer">
        <span>© {new Date().getFullYear()} SHAKH STORE</span>
        <span>{locale === "en" ? "SHAKH marketplace · Iraq" : locale === "ar" ? "سوق شاخ · العراق" : "بەرهەمی شاخ · عێراق"}</span>
      </footer>
    </main>
  );
}
