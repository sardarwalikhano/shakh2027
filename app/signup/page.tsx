import Link from "next/link";
import { signUp } from "./actions";
import { getMessages } from "@/lib/i18n/locale";

type SignupPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;
  const { messages: t } = await getMessages();

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link className="brand auth-brand" href="/">
          <span className="brand-mark">ش</span>
          <span><strong>SHAKH</strong><small>STORE</small></span>
        </Link>
        <span className="eyebrow"><i /> {t.createAccount}</span>
        <h1 className="auth-title">{t.signupTitle}</h1>
        <p className="auth-description">{t.signupDescription}</p>
        {params.error && <p className="form-error" role="alert">{t.signupError}</p>}
        {params.message === "check-email" && <p className="form-success" role="status">{t.signupSent}</p>}
        <form action={signUp} className="auth-form">
          <label htmlFor="fullName">{t.fullName}</label>
          <input id="fullName" name="fullName" type="text" autoComplete="name" required minLength={2} maxLength={120} />
          <label htmlFor="email">{t.email}</label>
          <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
          <label htmlFor="password">{t.passwordHint}</label>
          <input id="password" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} />
          <label htmlFor="passwordConfirmation">{t.passwordConfirm}</label>
          <input id="passwordConfirmation" name="passwordConfirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={128} />
          <button type="submit">{t.signupSubmit} <span>←</span></button>
        </form>
        <p className="auth-footnote">{t.alreadyAccount} <Link href="/login">{t.login}</Link></p>
      </section>
    </main>
  );
}
