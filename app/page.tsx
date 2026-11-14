const highlights = [
  { number: "01", title: "فرۆشگاکان", detail: "بازاڕێک بۆ فرۆشگاکانی شاخ و بازرگانەکان" },
  { number: "02", title: "داواکارییەکان", detail: "ڕێڕەوی ڕوونی کڕین، ئامادەکردن و گەیاندن" },
  { number: "03", title: "پارەدان و باڵانس", detail: "ژمێریاری پارێزراو بە دیناری عێراقی" },
];

export default function HomePage() {
  return (
    <main className="landing">
      <header className="topbar">
        <a className="brand" href="/" aria-label="SHAKH STORE">
          <span className="brand-mark">ش</span>
          <span><strong>SHAKH</strong><small>STORE</small></span>
        </a>
        <span className="market-label">بازاڕی دیجیتاڵی عێراق</span>
      </header>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><i /> پلاتفۆرمی بازرگانی شاخ</span>
          <h1>بازاڕێکی نوێ،<br /><em>ئەزموونێکی ئاسان.</em></h1>
          <p>شوێنێکی یەکگرتوو بۆ بینینی بەرهەمەکان، داواکردن و بەڕێوەبردنی فرۆشگا و گەیاندن؛ بە شێوەیەکی ڕێکخراو و پارێزراو.</p>
          <div className="hero-actions">
            <a className="primary-action" href="/login">چوونەژوورەوە <span>←</span></a>
            <span className="currency-note">IQD · دیناری عێراقی</span>
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
      <section className="highlights" aria-label="بەشەکانی پلاتفۆرم">
        {highlights.map((item) => (
          <article className="highlight" key={item.number}>
            <span className="highlight-number">{item.number}</span>
            <div><h2>{item.title}</h2><p>{item.detail}</p></div>
            <span className="highlight-arrow">↗</span>
          </article>
        ))}
      </section>
      <footer className="footer">
        <span>© {new Date().getFullYear()} SHAKH STORE</span>
        <span>بەرهەمی شاخ · عێراق</span>
      </footer>
    </main>
  );
}
