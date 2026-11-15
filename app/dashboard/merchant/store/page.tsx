import { createClient } from "@/lib/supabase/server";
import { requireAnyRole } from "@/lib/auth/context";
import { getMessages } from "@/lib/i18n/locale";
import { merchantStoreTypesForRoles, type MerchantStoreType } from "@/lib/domain/stores";
import { submitMerchantStore } from "./actions";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

type StoreRow = {
  id: string;
  store_type: string;
  name: string;
  slug: string;
  status: string;
  governorate: string | null;
  review_note: string | null;
  created_at: string;
};

function storeTypeLabel(type: string, t: Awaited<ReturnType<typeof getMessages>>["messages"]) {
  switch (type) {
    case "restaurant": return t.storeTypeRestaurant;
    case "supermarket": return t.storeTypeSupermarket;
    case "meat_seafood": return t.storeTypeMeatSeafood;
    case "baqal": return t.storeTypeBaqal;
    default: return type;
  }
}

function statusLabel(status: string, t: Awaited<ReturnType<typeof getMessages>>["messages"]) {
  switch (status) {
    case "pending": return t.storeStatusPending;
    case "active": return t.storeStatusActive;
    case "rejected": return t.storeStatusRejected;
    case "suspended": return t.storeStatusSuspended;
    default: return status;
  }
}

export default async function MerchantStorePage({ searchParams }: Props) {
  const context = await requireAnyRole(["restaurant", "supermarket", "meat_seafood_vendor", "baqal"]);
  const [{ messages: t }, params, supabase] = await Promise.all([
    getMessages(),
    searchParams,
    createClient(),
  ]);

  const { data, error } = await supabase
    .from("stores")
    .select("id, store_type, name, slug, status, governorate, review_note, created_at")
    .eq("owner_id", context.userId)
    .order("created_at", { ascending: false });

  const migrationUnavailable = Boolean(error && (
    error.code === "PGRST205"
    || error.code === "42P01"
    || /public\.stores|schema cache|does not exist/i.test(error.message)
  ));

  const stores = (data ?? []) as StoreRow[];
  const existingTypes = new Set(
    stores.filter((store) => store.status !== "rejected").map((store) => store.store_type),
  );
  const availableTypes = merchantStoreTypesForRoles(context.roles)
    .filter((type) => !existingTypes.has(type));

  const errorMessage = migrationUnavailable
    ? t.storeModuleUnavailable
    : params.error === "duplicate" ? t.storeDuplicateError
    : params.error === "role" ? t.storeRoleError
    : params.error === "slug" ? t.storeSlugError
    : params.error === "invalid" ? t.storeInvalidError
    : params.error === "migration" ? t.storeModuleUnavailable
    : params.error ? t.storeApplicationError
    : null;

  return (
    <main className="dashboard-page">
      <section className="dashboard-section">
        <span className="eyebrow"><i /> {t.merchantEyebrow}</span>
        <h1 className="section-title">{t.storePageTitle}</h1>
        <p className="section-description">{t.storePageDescription}</p>

        {params.success === "created" && (
          <p className="form-success" role="status">{t.storeSubmissionSuccess}</p>
        )}
        {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}

        <div className="store-section-heading">
          <h2>{t.storeApplications}</h2>
          <span>{stores.length}</span>
        </div>

        {stores.length === 0 ? (
          <p className="empty-state">{t.storeNoApplications}</p>
        ) : (
          <div className="store-card-grid">
            {stores.map((store) => (
              <article className="store-card" key={store.id}>
                <div className="store-card-heading">
                  <div>
                    <span className="store-type-label">{storeTypeLabel(store.store_type, t)}</span>
                    <h3>{store.name}</h3>
                  </div>
                  <span className={`store-status store-status-${store.status}`}>
                    {statusLabel(store.status, t)}
                  </span>
                </div>
                <p className="store-slug" dir="ltr">/{store.slug}</p>
                {store.governorate && <p className="store-meta">{store.governorate}</p>}
                {store.review_note && <p className="store-review-note">{store.review_note}</p>}
                {store.status === "pending" && <p className="store-meta">{t.storePendingReview}</p>}
              </article>
            ))}
          </div>
        )}

        {!migrationUnavailable && availableTypes.length > 0 && (
          <section className="store-form-panel">
            <h2>{t.storeNewApplication}</h2>
            <form action={submitMerchantStore} className="store-form">
              <div className="store-form-grid">
                <label>
                  {t.storeType}
                  <select name="storeType" required defaultValue={availableTypes[0]}>
                    {availableTypes.map((type: MerchantStoreType) => (
                      <option key={type} value={type}>{storeTypeLabel(type, t)}</option>
                    ))}
                  </select>
                </label>
                <label>
                  {t.storeName}
                  <input name="name" required minLength={2} maxLength={120} />
                </label>
                <label>
                  {t.storeSlug}
                  <input name="slug" dir="ltr" placeholder="my-store" pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} />
                  <small>{t.storeSlugHint}</small>
                </label>
                <label>
                  {t.storeGovernorate}
                  <input name="governorate" required minLength={2} maxLength={100} />
                </label>
                <label>
                  {t.storeDistrict}
                  <input name="district" maxLength={100} />
                </label>
                <label>
                  {t.storePhone}
                  <input name="phone" type="tel" dir="ltr" maxLength={32} />
                </label>
                <label>
                  {t.storeEmail}
                  <input name="contactEmail" type="email" dir="ltr" maxLength={254} />
                </label>
                <label className="store-form-full">
                  {t.storeAddress}
                  <input name="addressLine" maxLength={300} />
                </label>
                <label className="store-form-full">
                  {t.storeDescriptionField}
                  <textarea name="description" rows={4} maxLength={1500} />
                </label>
              </div>
              <button className="primary-action" type="submit">{t.storeSubmit}<span>←</span></button>
            </form>
          </section>
        )}
      </section>
    </main>
  );
}
