import Link from "next/link";
import { signIn } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const hasError = params.error === "invalid";

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link className="brand auth-brand" href="/">
          <span className="brand-mark">ش</span>
          <span><strong>SHAKH</strong><small>STORE</small></span>
        </Link>
        <span className="eyebrow"><i /> چوونەژوورەوەی سیستەم</span>
        <h1 className="auth-title">بەخێربێیتەوە</h1>
        <p className="auth-description">بۆ بەردەوامبوون، زانیارییەکانی هەژمارەکەت بنووسە.</p>
        {hasError && <p className="form-error" role="alert">ئیمەیڵ یان وشەی نهێنی دروست نییە.</p>}
        <form action={signIn} className="auth-form">
          <label htmlFor="email">ئیمەیڵ</label>
          <input id="email" name="email" type="email" autoComplete="username" required maxLength={254} />
          <label htmlFor="password">وشەی نهێنی</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={1024} />
          <button type="submit">چوونەژوورەوە <span>←</span></button>
        </form>
        <Link className="back-link" href="/">گەڕانەوە بۆ پەڕەی سەرەکی</Link>
      </section>
    </main>
  );
}
