"use client";

import Link from "next/link";

type DashboardErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function DashboardError({ reset }: DashboardErrorProps) {
  return (
    <main className="dashboard-page">
      <section className="dashboard-welcome" role="alert" aria-live="polite">
        <span className="eyebrow"><i /> SHAKH STORE</span>
        <h1>داشبۆرد ئێستا بەردەست نییە</h1>
        <p>
          پەیوەندی بە خزمەتگوزاریی هەژمار یان داتابەیس کێشەی هەیە.
          تکایە دووبارە هەوڵ بدەرەوە یان بگەڕێوە بۆ چوونەژوورەوە.
        </p>
        <div className="hero-actions">
          <button className="primary-action" type="button" onClick={reset}>
            دووبارە هەوڵدان
          </button>
          <Link className="secondary-action" href="/login">
            چوونەژوورەوە
          </Link>
        </div>
      </section>
    </main>
  );
}
