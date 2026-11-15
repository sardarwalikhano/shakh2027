import Link from "next/link";
import { signIn } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const hasError = params.error === "invalid";
  const message = params.message;

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
        {params.error === "callback" && <p className="form-error" role="alert">بەستەری پشتڕاستکردنەوە ناتەواوە یان بەسەرچووە.</p>}
        {params.error === "session" && <p className="form-error" role="alert">تکایە دووبارە لە بەستەری نوێکردنەوەی وشەی نهێنی بکەرەوە.</p>}
        {message === "check-email" && <p className="form-success" role="status">ئیمەیڵی پشتڕاستکردنەوە نێردراوە.</p>}
        {message === "password-updated" && <p className="form-success" role="status">وشەی نهێنی بە سەرکەوتوویی نوێ کرایەوە.</p>
        <form action={signIn} className="auth-form">
          <label htmlFor="email">ئیمەیڵ</label>
          <input id="email" name="email" type="email" autoComplete="username" required maxLength={254} />
          <label htmlFor="password">وشەی نهێنی</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={1024} />
          <button type="submit">چوونەژوورەوە <span>←</span></button>
        </form>
        <Link className="forgot-link" href="/forgot-password">وشەی نهێنیت لەبیرچووە؟</Link>
        <Link className="back-link" href="/">گەڕانەوە بۆ پەڕەی سەرەکی</Link>
      </section>
    </main>
  );
}
