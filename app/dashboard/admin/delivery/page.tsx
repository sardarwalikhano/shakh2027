import { redirect } from "next/navigation";
import { requireAnyRole } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { getMessages } from "@/lib/i18n/locale";
import { saveStoreDeliveryFee } from "./actions";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ error?: string; success?: string }> };
type DeliverySetting = { delivery_fee_iqd: number | string; is_enabled: boolean };
type StoreRow = {
  id: string;
  name: string;
  store_type: string;
  store_delivery_settings: DeliverySetting | DeliverySetting[] | null;
};

export default async function AdminDeliveryPage({ searchParams }: Props) {
  await requireAnyRole(["super_admin"]);
  const [{ messages: t }, params, supabase] = await Promise.all([
    getMessages(),
    searchParams,
    createClient(),
  ]);

  const { data, error } = await supabase
    .from("stores")
    .select("id, name, store_type, store_delivery_settings(delivery_fee_iqd, is_enabled)")
    .eq("status", "active")
    .order("name");

  const missingSchema = Boolean(error && (
    error.code === "PGRST205"
    || error.code === "42P01"
    || /schema cache|does not exist/i.test(error.message)
  ));
  const stores = (data ?? []) as unknown as StoreRow[];

  const errorText = missingSchema || params.error === "migration"
    ? t.checkoutSchemaMissing
    : params.error === "forbidden" ? t.checkoutForbidden
    : params.error === "config" ? t.checkoutConfigError
    : params.error === "invalid" ? t.invalidCart
    : params.error ? t.checkoutFailed
    : null;

  return (
    <main className="dashboard-page delivery-settings-page">
      <section className="dashboard-section">
        <span className="eyebrow"><i /> Super Admin</span>
        <h1 className="section-title">{t.adminDeliveryTitle}</h1>
        <p className="section-description">{t.adminDeliveryIntro}</p>

        {params.success === "saved" && <p className="form-success" role="status">{t.adminDeliverySaved}</p>}
        {errorText && <p className="form-error" role="alert">{errorText}</p>}

        {!missingSchema && stores.length === 0 && <p className="empty-state">{t.adminDeliveryMissing}</p>}

        <div className="delivery-settings-list">
          {stores.map((store) => {
            const raw = store.store_delivery_settings;
            const setting = Array.isArray(raw) ? raw[0] ?? null : raw;
            return (
              <section className="delivery-setting-card" key={store.id}>
                <div>
                  <span className="store-type-label">{store.store_type}</span>
                  <h2>{store.name}</h2>
                  {!setting && <p className="form-error">{t.adminDeliveryMissing}</p>}
                </div>
                <form action={saveStoreDeliveryFee} className="delivery-setting-form">
                  <input type="hidden" name="storeId" value={store.id} />
                  <label>
                    {t.adminDeliveryFee}
                    <input
                      name="deliveryFeeIqd"
                      type="number"
                      min="0"
                      max="5000000"
                      step="1"
                      required
                      defaultValue={setting ? Number(setting.delivery_fee_iqd) : ""}
                    />
                  </label>
                  <label className="delivery-enabled-label">
                    <input
                      name="isEnabled"
                      type="checkbox"
                      defaultChecked={setting?.is_enabled ?? false}
                    />
                    {t.adminDeliveryEnabled}
                  </label>
                  <button className="primary-action" type="submit">{t.adminDeliverySave}</button>
                </form>
              </section>
            );
          })}
        </div>
      </section>
    </main>
  );
}
