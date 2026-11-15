import Link from "next/link";
import { updatePassword } from "./actions";

type Props = { searchParams: Promise<{ error?: string }> };

export default async function ResetPasswordPage({ searchParams }: Props) {
  const params = await searchParams;
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link className="brand auth-brand" href="/">
          <span className="brand-mark">ش</span>
          <span><strong>SHAKH</strong><small>STORE</small></span>
        </Link>
        <span className="eyebrow"><i /> نوێکردنەوەی وشەی نهێنی</span>
        <h1 className="auth-title">وشەی نهێنی نوێ دابنێ</h1>
        {params.error && <p className="form-error" role="alert">وشەی نهێنییەکە پشتڕاست بکەرەوە و دووبارە هەوڵ بدەرەوە.</p>}
        <form action={updatePassword} className="auth-form">
          <label htmlFor="password">وشەی نهێنی نوێ (لانیکەم ١٢ پیت)</label>
          <input id="password" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} />
          <label htmlFor="passwordConfirmation">دووبارەکردنەوە</label>
          <input id="passwordConfirmation" name="passwordConfirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={128} />
          <button type="submit">نوێکردنەوەی وشەی نهێنی</button>
        </form>
      </section>
    </main>
  );
}
