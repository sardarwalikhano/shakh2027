import Link from "next/link";
import { requestPasswordReset } from "./actions";
import { getMessages } from "@/lib/i18n/locale";

type Props = { searchParams: Promise<{ error?: string; message?: string }> };

export default async function ForgotPasswordPage({ searchParams }: Props) {
  const params = await searchParams;
  const { messages: t } = await getMessages();
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link className="brand auth-brand" href="/">
          <span className="brand-mark">ش</span>
          <span><strong>SHAKH</strong><small>STORE</small></span>
        </Link>
        <span className="eyebrow"><i /> {t.forgotPassword}</span>
        <h1 className="auth-title">{t.forgotTitle}</h1>
        <p className="auth-description">{t.forgotDescription}</p>
        {params.error && <p className="form-error" role="alert">{t.signupError}</p>}
        {params.message === "sent" && <p className="form-success" role="status">{t.resetSent}</p>}
        <form action={requestPasswordReset} className="auth-form">
          <label htmlFor="email">{t.email}</label>
          <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
          <button type="submit">{t.sendLink} <span>←</span></button>
        </form>
        <Link className="back-link" href="/login">{t.login}</Link>
      </section>
    </main>
  );
}
