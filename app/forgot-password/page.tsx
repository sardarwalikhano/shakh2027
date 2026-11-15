import Link from "next/link";
import { requestPasswordReset } from "./actions";

type Props = { searchParams: Promise<{ error?: string; message?: string }> };

export default async function ForgotPasswordPage({ searchParams }: Props) {
  const params = await searchParams;
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link className="brand auth-brand" href="/">
          <span className="brand-mark">ش</span>
          <span><strong>SHAKH</strong><small>STORE</small></span>
        </Link>
        <span className="eyebrow"><i /> پاراستنی هەژمار</span>
        <h1 className="auth-title">وشەی نهێنیت لەبیر چووە؟</h1>
        <p className="auth-description">ئیمەیڵەکەت بنووسە بۆ ناردنی بەستەری گۆڕینی وشەی نهێنی.</p>
        {params.error && <p className="form-error" role="alert">تکایە ئیمەیڵێکی دروست بنووسە.</p>}
        {params.message === "sent" && <p className="form-success" role="status">ئەگەر هەژمارێک بەو ئیمەیڵە هەبێت، بەستەری گۆڕینی وشەی نهێنی دەنێردرێت.</p>}
        <form action={requestPasswordReset} className="auth-form">
          <label htmlFor="email">ئیمەیڵ</label>
          <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
          <button type="submit">ناردنی بەستەر <span>←</span></button>
        </form>
        <Link className="back-link" href="/login">گەڕانەوە بۆ چوونەژوورەوە</Link>
      </section>
    </main>
  );
}
