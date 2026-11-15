import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuthContext } from "@/lib/auth/context";
import { getMessages } from "@/lib/i18n/locale";
import { updateOwnProfile } from "./actions";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

type ProfileRow = {
  full_name: string | null;
  phone: string | null;
  locale: "ku" | "ar" | "en";
  updated_at: string;
};

export default async function ProfilePage({ searchParams }: Props) {
  const context = await requireAuthContext();
  const [{ messages: t }, params, supabase] = await Promise.all([
    getMessages(),
    searchParams,
    createClient(),
  ]);

  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, phone, locale, updated_at")
    .eq("id", context.userId)
    .maybeSingle();

  if (error || !data) redirect("/dashboard?error=profile");

  const profile = data as ProfileRow;

  const errorMessage = params.error === "invalid"
    ? t.profileInvalid
    : params.error === "update" || params.error === "config"
      ? t.profileUpdateError
      : params.error === "forbidden"
        ? t.profileForbidden
        : null;

  return (
    <main className="dashboard-page profile-page">
      <section className="dashboard-section">
        <span className="eyebrow"><i /> {t.profileEyebrow}</span>
        <h1 className="section-title">{t.profileTitle}</h1>
        <p className="section-description">{t.profileDescription}</p>

        {params.success === "updated" && (
          <p className="form-success" role="status">{t.profileUpdated}</p>
        )}
        {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}

        <div className="profile-layout">
          <section className="profile-summary-card" aria-label={t.profileAccountDetails}>
            <span className="profile-avatar" aria-hidden="true">
              {(profile.full_name ?? context.email ?? "S").trim().charAt(0).toUpperCase()}
            </span>
            <h2>{profile.full_name ?? t.currentAccount}</h2>
            <p dir="ltr">{context.email ?? "—"}</p>
            <span className="profile-readonly-note">{t.profileEmailReadOnly}</span>
            <div className="profile-role-list">
              <span>{t.activeRoles}</span>
              {context.roles.length === 0 ? (
                <strong>{t.noRoles}</strong>
              ) : context.roles.map((role) => (
                <strong key={role}>{t.roleLabels[role]}</strong>
              ))}
            </div>
          </section>

          <section className="profile-form-panel">
            <h2>{t.profileEditTitle}</h2>
            <form action={updateOwnProfile} className="profile-form">
              <label htmlFor="fullName">{t.fullName}</label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                minLength={2}
                maxLength={120}
                autoComplete="name"
                defaultValue={profile.full_name ?? ""}
              />

              <label htmlFor="phone">{t.profilePhone}</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                dir="ltr"
                inputMode="tel"
                autoComplete="tel"
                minLength={7}
                maxLength={32}
                pattern="[0-9+(). -]{7,32}"
                defaultValue={profile.phone ?? ""}
                placeholder="+964 7xx xxx xxxx"
              />
              <small>{t.profilePhoneHint}</small>

              <label htmlFor="email">{t.email}</label>
              <input
                id="email"
                name="email"
                type="email"
                dir="ltr"
                value={context.email ?? ""}
                disabled
                readOnly
              />

              <button className="primary-action" type="submit">
                {t.profileSave}
                <span>←</span>
              </button>
            </form>
          </section>
        </div>
      </section>
    </main>
  );
}
