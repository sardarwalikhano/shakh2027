import Link from "next/link";
import { signUp } from "./actions";

type SignupPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link className="brand auth-brand" href="/">
          <span className="brand-mark">ش</span>
          <span><strong>SHAKH</strong><small>STORE</small></span>
        </Link>
        <span className="eyebrow"><i /> دروستکردنی هەژمار</span>
        <h1 className="auth-title">بەخێربێیت بۆ شاخ</h1>
        <p className="auth-description">هەژمارێک دروست بکە بۆ دەستپێکردن. ڕۆڵ و دەسەڵاتەکان لەلایەن سیستەمەوە پشتڕاست دەکرێنەوە.</p>
        {params.error && <p className="form-error" role="alert">زانیارییەکان پشتڕاست بکەرەوە و دووبارە هەوڵ بدەرەوە.</p>}
        {params.message === "check-email" && <p className="form-success" role="status">ئیمەیڵی پشتڕاستکردنەوە نێردراوە. بۆ چالاککردنی هەژمارەکەت ئیمەیڵەکەت بپشکنە.</p>}
        <form action={signUp} className="auth-form">
          <label htmlFor="fullName">ناوی تەواو</label>
          <input id="fullName" name="fullName" type="text" autoComplete="name" required minLength={2} maxLength={120} />
          <label htmlFor="email">ئیمەیڵ</label>
          <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
          <label htmlFor="password">وشەی نهێنی (لانیکەم ١٢ پیت)</label>
          <input id="password" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} />
          <label htmlFor="passwordConfirmation">دووبارەکردنەوەی وشەی نهێنی</label>
          <input id="passwordConfirmation" name="passwordConfirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={128} />
          <button type="submit">دروستکردنی هەژمار <span>←</span></button>
        </form>
        <p className="auth-footnote">پێشتر هەژمارت هەیە؟ <Link href="/login">چوونەژوورەوە</Link></p>
      </section>
    </main>
  );
}
