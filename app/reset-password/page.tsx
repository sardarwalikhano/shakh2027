import Link from "next/link";
import { updatePassword } from "./actions";
import { getMessages } from "@/lib/i18n/locale";

type Props = { searchParams: Promise<{ error?: string }> };

export default async function ResetPasswordPage({ searchParams }: Props) {
  const params = await searchParams;
  const { messages: t } = await getMessages();
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link className="brand auth-brand" href="/">
          <span className="brand-mark">ش</span>
          <span><strong>SHAKH</strong><small>STORE</small></span>
        </Link>
        <span className="eyebrow"><i /> {t.resetEyebrow}</span>
        <h1 className="auth-title">{t.resetTitle}</h1>
        {params.error && <p className="form-error" role="alert">{t.signupError}</p>}
        <form action={updatePassword} className="auth-form">
          <label htmlFor="password">{t.passwordHint}</label>
          <input id="password" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} />
          <label htmlFor="passwordConfirmation">{t.passwordConfirm}</label>
          <input id="passwordConfirmation" name="passwordConfirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={128} />
          <button type="submit">{t.resetSubmit}</button>
        </form>
      </section>
    </main>
  );
}
