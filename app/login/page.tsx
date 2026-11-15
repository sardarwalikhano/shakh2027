import Link from "next/link";
import { signIn } from "./actions";
import { getMessages } from "@/lib/i18n/locale";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const { messages: t } = await getMessages();

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link className="brand auth-brand" href="/">
          <span className="brand-mark">ش</span>
          <span><strong>SHAKH</strong><small>STORE</small></span>
        </Link>
        <span className="eyebrow"><i /> {t.loginEyebrow}</span>
        <h1 className="auth-title">{t.loginTitle}</h1>
        <p className="auth-description">{t.loginDescription}</p>
        {params.error === "invalid" && <p className="form-error" role="alert">{t.loginError}</p>}
        {params.error === "callback" && <p className="form-error" role="alert">{t.callbackError}</p>}
        {params.error === "session" && <p className="form-error" role="alert">{t.sessionError}</p>}
        {params.message === "check-email" && <p className="form-success" role="status">{t.emailSent}</p>}
        {params.message === "password-updated" && <p className="form-success" role="status">{t.passwordUpdated}</p>}
        <form action={signIn} className="auth-form">
          <label htmlFor="email">{t.email}</label>
          <input id="email" name="email" type="email" autoComplete="username" required maxLength={254} />
          <label htmlFor="password">{t.password}</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={1024} />
          <button type="submit">{t.login} <span>←</span></button>
        </form>
        <Link className="forgot-link" href="/forgot-password">{t.forgotPassword}</Link>
        <Link className="back-link" href="/">{t.backHome}</Link>
      </section>
    </main>
  );
}
