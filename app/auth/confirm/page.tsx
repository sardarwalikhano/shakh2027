import Link from "next/link";
import { confirmAuthEmail } from "./actions";
import { getMessages } from "@/lib/i18n/locale";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    token_hash?: string;
    type?: string;
    error?: string;
  }>;
};

export default async function AuthConfirmPage({ searchParams }: Props) {
  const params = await searchParams;
  const { messages: t } = await getMessages();

  const tokenHash = params.token_hash ?? "";
  const type = params.type ?? "";
  const validToken = tokenHash.length >= 16 && tokenHash.length <= 512 &&
    /^[A-Za-z0-9_-]+$/.test(tokenHash);
  const validType = type === "email" || type === "recovery";
  const canConfirm = validToken && validType && !params.error;

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link className="brand auth-brand" href="/">
          <span className="brand-mark">ش</span>
          <span><strong>SHAKH</strong><small>STORE</small></span>
        </Link>
        <span className="eyebrow"><i /> {t.confirmTitle}</span>
        <h1 className="auth-title">{t.confirmTitle}</h1>
        <p className="auth-description">{t.confirmDescription}</p>

        {!canConfirm ? (
          <p className="form-error" role="alert">
            {t.confirmInvalid}
          </p>
        ) : (
          <form action={confirmAuthEmail} className="auth-form">
            <input type="hidden" name="token_hash" value={tokenHash} />
            <input type="hidden" name="type" value={type} />
            <button type="submit">
              {t.confirmButton}
              <span>←</span>
            </button>
          </form>
        )}

        <Link className="back-link" href="/login">{t.login}</Link>
      </section>
    </main>
  );
}
