import { createClient } from "@/lib/supabase/server";
import { requireAnyRole } from "@/lib/auth/context";
import { getMessages } from "@/lib/i18n/locale";
import { reviewMerchantStore } from "./actions";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

type PendingStore = {
  id: string;
  owner_id: string;
  store_type: string;
  name: string;
  slug: string;
  description: string | null;
  phone: string | null;
  contact_email: string | null;
  governorate: string | null;
  district: string | null;
  address_line: string | null;
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

export default async function AdminStoresPage({ searchParams }: Props) {
  await requireAnyRole(["super_admin"]);
  const [{ messages: t }, params, supabase] = await Promise.all([
    getMessages(),
    searchParams,
    createClient(),
  ]);

  const { data, error } = await supabase
    .from("stores")
    .select("id, owner_id, store_type, name, slug, description, phone, contact_email, governorate, district, address_line, created_at")
    .eq("status", "pending")
    .neq("store_type", "shakh_store")
    .order("created_at", { ascending: true });

  const migrationUnavailable = Boolean(error && (
    error.code === "PGRST205"
    || error.code === "42P01"
    || /public\.stores|schema cache|does not exist/i.test(error.message)
  ));
  const applications = (data ?? []) as PendingStore[];

  const successMessage = params.success === "approved"
    ? t.storeReviewSuccessApproved
    : params.success === "rejected" ? t.storeReviewSuccessRejected : null;
  const errorMessage = migrationUnavailable || params.error === "migration"
    ? t.storeModuleUnavailable
    : params.error === "forbidden" ? t.storeReviewForbidden
    : params.error ? t.storeReviewError : error ? t.storeReviewError : null;

  return (
    <main className="dashboard-page">
      <section className="dashboard-section">
        <span className="eyebrow"><i /> Super Admin</span>
        <h1 className="section-title">{t.adminStoresTitle}</h1>
        <p className="section-description">{t.adminStoresDescription}</p>

        {successMessage && <p className="form-success" role="status">{successMessage}</p>}
        {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}

        <div className="store-section-heading">
          <h2>{t.adminStoresTitle}</h2>
          <span>{applications.length}</span>
        </div>

        {applications.length === 0 ? (
          <p className="empty-state">{t.adminStoresEmpty}</p>
        ) : (
          <div className="store-card-grid">
            {applications.map((store) => (
              <article className="store-card" key={store.id}>
                <div className="store-card-heading">
                  <div>
                    <span className="store-type-label">{storeTypeLabel(store.store_type, t)}</span>
                    <h3>{store.name}</h3>
                  </div>
                  <span className="store-status store-status-pending">{t.storeStatusPending}</span>
                </div>
                <p className="store-slug" dir="ltr">/{store.slug}</p>
                {store.description && <p className="store-meta">{store.description}</p>}
                <dl className="store-contact-list">
                  {store.governorate && <div><dt>{t.storeGovernorate}</dt><dd>{store.governorate}</dd></div>}
                  {store.district && <div><dt>{t.storeDistrict}</dt><dd>{store.district}</dd></div>}
                  {store.address_line && <div><dt>{t.storeAddress}</dt><dd>{store.address_line}</dd></div>}
                  {store.phone && <div><dt>{t.storePhone}</dt><dd dir="ltr">{store.phone}</dd></div>}
                  {store.contact_email && <div><dt>{t.storeEmail}</dt><dd dir="ltr">{store.contact_email}</dd></div>}
                </dl>
                <form action={reviewMerchantStore} className="store-review-form">
                  <input type="hidden" name="storeId" value={store.id} />
                  <label>
                    {t.storeReviewNote}
                    <textarea name="note" rows={2} maxLength={1000} />
                  </label>
                  <div className="store-review-actions">
                    <button type="submit" name="decision" value="approve" className="review-approve">{t.storeApprove}</button>
                    <button type="submit" name="decision" value="reject" className="review-reject">{t.storeReject}</button>
                  </div>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
