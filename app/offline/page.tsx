import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <span className="brand-mark">ش</span>
        <h1 className="auth-title">پەیوەندی ئینتەرنێت نییە</h1>
        <p className="auth-description">ئەم پەڕەیە بەبێ پەیوەندی بەردەست نییە. پەیوەندی ئینتەرنێت بگەڕێنەوە و دووبارە هەوڵ بدەرەوە.</p>
        <Link className="primary-action" href="/">هەوڵدانەوە <span>↻</span></Link>
      </section>
    </main>
  );
}
