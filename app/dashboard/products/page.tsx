import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuthContext } from "@/lib/auth/context";
import { getMessages } from "@/lib/i18n/locale";
import { isStoreType, type ProductCategory, type StoreType } from "@/lib/domain/roles";
import { categoriesForStore } from "@/lib/domain/catalog";
import { archiveStoreProduct, createStoreProduct, updateStoreProduct } from "./actions";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ error?: string; success?: string }> };

type StoreRow = {
  id: string;
  store_type: StoreType;
  name: string;
  slug: string;
  status: string;
};

type ProductRow = {
  id: string;
  store_id: string;
  category: ProductCategory;
  name: string;
  slug: string;
  description: string | null;
  price_iqd: number | string;
  unit_label: string;
  stock_quantity: number | string | null;
  image_path: string;
  status: "published" | "draft" | "archived";
  created_at: string;
};

const MANAGER_ROLES = [
  "super_admin",
  "restaurant",
  "supermarket",
  "meat_seafood_vendor",
  "baqal",
] as const;

function categoryLabel(category: ProductCategory, t: Awaited<ReturnType<typeof getMessages>>["messages"]) {
  const labels: Record<ProductCategory, string> = {
    restaurant: t.productCategoryRestaurant,
    supermarket: t.productCategorySupermarket,
    meat_seafood: t.productCategoryMeatSeafood,
    baqal: t.productCategoryBaqal,
    produce: t.productCategoryProduce,
    drinks: t.productCategoryDrinks,
    household: t.productCategoryHousehold,
    other: t.productCategoryOther,
  };
  return labels[category];
}

function statusLabel(status: ProductRow["status"], t: Awaited<ReturnType<typeof getMessages>>["messages"]) {
  if (status === "published") return t.productStatusPublished;
  if (status === "draft") return t.productStatusDraft;
  return t.productStatusArchived;
}

function formatPrice(value: number | string, locale: string) {
  const amount = Number(value);
  return `${amount.toLocaleString(locale === "ku" ? "ku-IQ" : locale === "ar" ? "ar-IQ" : "en-IQ")} IQD`;
}

export default async function ProductManagementPage({ searchParams }: Props) {
  const context = await requireAuthContext();
  const isManager = context.roles.some((role) => MANAGER_ROLES.includes(role as (typeof MANAGER_ROLES)[number]));
  if (!isManager) redirect("/dashboard");

  const [{ messages: t, locale }, params, supabase] = await Promise.all([
    getMessages(),
    searchParams,
    createClient(),
  ]);

  const stores: StoreRow[] = [];
  let storeError: { code?: string; message: string } | null = null;

  if (context.roles.includes("super_admin")) {
    const { data, error } = await supabase
      .from("stores")
      .select("id, store_type, name, slug, status")
      .eq("store_type", "shakh_store")
      .is("owner_id", null)
      .eq("status", "active")
      .maybeSingle();
    if (error) storeError = error;
    else if (data && isStoreType(data.store_type)) stores.push(data as StoreRow);
  }

  if (context.roles.some((role) => ["restaurant", "supermarket", "meat_seafood_vendor", "baqal"].includes(role))) {
    const { data, error } = await supabase
      .from("stores")
      .select("id, store_type, name, slug, status")
      .eq("owner_id", context.userId)
      .eq("status", "active")
      .order("created_at", { ascending: true });
    if (error) storeError = error;
    else {
      for (const row of data ?? []) {
        if (isStoreType(row.store_type) && !stores.some((store) => store.id === row.id)) {
          stores.push(row as StoreRow);
        }
      }
    }
  }

  const migrationMissing = Boolean(storeError && (
    storeError.code === "PGRST205"
    || storeError.code === "42P01"
    || /public\.stores|schema cache|does not exist/i.test(storeError.message)
  ));

  const storeIds = stores.map((store) => store.id);
  let products: ProductRow[] = [];
  let productError: { code?: string; message: string } | null = null;
  if (!migrationMissing && storeIds.length > 0) {
    const { data, error } = await supabase
      .from("products")
      .select("id, store_id, category, name, slug, description, price_iqd, unit_label, stock_quantity, image_path, status, created_at")
      .in("store_id", storeIds)
      .order("created_at", { ascending: false });
    if (error) productError = error;
    else products = (data ?? []) as ProductRow[];
  }

  const catalogMigrationMissing = Boolean(productError && (
    productError.code === "PGRST205"
    || productError.code === "42P01"
    || /public\.products|schema cache|does not exist/i.test(productError.message)
  ));

  const errorMessage = migrationMissing || catalogMigrationMissing || params.error === "migration"
    ? t.productModuleUnavailable
    : params.error === "forbidden" ? t.productForbidden
    : params.error === "duplicate" ? t.productDuplicate
    : params.error === "image" ? t.productImageError
    : params.error === "create" ? t.productCreateError
    : params.error === "update" ? t.productUpdateError
    : params.error === "archive" ? t.productArchiveError
    : params.error ? t.productInvalid
    : null;

  const successMessage = params.success === "created"
    ? t.productCreated
    : params.success === "updated" ? t.productUpdated
    : params.success === "archived" ? t.productArchived
    : null;

  return (
    <main className="dashboard-page product-management-page">
      <section className="dashboard-section">
        <span className="eyebrow"><i /> {t.productEyebrow}</span>
        <h1 className="section-title">{t.productManagementTitle}</h1>
        <p className="section-description">{t.productManagementDescription}</p>

        {successMessage && <p className="form-success" role="status">{successMessage}</p>}
        {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}

        {!migrationMissing && !catalogMigrationMissing && stores.length === 0 && (
          <div className="empty-state">
            <p>{t.productNoActiveStore}</p>
            {context.roles.some((role) => ["restaurant", "supermarket", "meat_seafood_vendor", "baqal"].includes(role)) && (
              <Link className="secondary-action" href="/dashboard/merchant/store">{t.merchantStoreLink}</Link>
            )}
          </div>
        )}

        {!migrationMissing && !catalogMigrationMissing && stores.map((store) => {
          const categories = categoriesForStore(store.store_type);
          const storeProducts = products.filter((product) => product.store_id === store.id);

          return (
            <section className="product-store-section" key={store.id}>
              <div className="store-section-heading">
                <div>
                  <span className="store-type-label">{store.store_type === "shakh_store" ? t.platformStore : t.merchantTitle}</span>
                  <h2>{store.name}</h2>
                </div>
                <span>{storeProducts.length}</span>
              </div>

              <div className="product-form-panel">
                <h3>{t.productNew}</h3>
                <form action={createStoreProduct} className="product-form">
                  <input type="hidden" name="storeId" value={store.id} />
                  <div className="product-form-grid">
                    <label>
                      {t.productCategory}
                      <select name="category" required defaultValue={categories[0]}>
                        {categories.map((category) => (
                          <option value={category} key={category}>{categoryLabel(category, t)}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {t.productName}
                      <input name="name" required minLength={2} maxLength={120} />
                    </label>
                    <label>
                      {t.productSlug}
                      <input name="slug" dir="ltr" minLength={3} maxLength={100} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="product-name" />
                    </label>
                    <label>
                      {t.productPrice}
                      <input name="priceIqd" type="number" min="1" max="100000000000" step="1" inputMode="numeric" required />
                      <small>IQD · {t.productPriceInteger}</small>
                    </label>
                    <label>
                      {t.productUnit}
                      <input name="unitLabel" required maxLength={32} defaultValue="piece" />
                    </label>
                    <label>
                      {t.productStock}
                      <input name="stockQuantity" type="number" min="0" step="0.001" inputMode="decimal" />
                    </label>
                    <label className="product-form-full">
                      {t.productDescriptionField}
                      <textarea name="description" rows={3} maxLength={2000} />
                    </label>
                    <label className="product-form-full">
                      {t.productImage}
                      <input name="image" type="file" accept="image/jpeg,image/png,image/webp" required />
                      <small>{t.productImageHint}</small>
                    </label>
                  </div>
                  <button className="primary-action" type="submit">{t.productPublish}<span>←</span></button>
                </form>
              </div>

              <div className="product-card-grid">
                {storeProducts.length === 0 ? (
                  <p className="empty-state">{t.productNoItems}</p>
                ) : storeProducts.map((product) => {
                  const imageUrl = supabase.storage.from("product-images").getPublicUrl(product.image_path).data.publicUrl;
                  return (
                    <article className="product-card" key={product.id}>
                      <Image
                        src={imageUrl}
                        alt={product.name}
                        width={640}
                        height={480}
                        unoptimized
                      />
                      <div className="product-card-body">
                        <div className="product-card-heading">
                          <span className="store-type-label">{categoryLabel(product.category, t)}</span>
                          <span className={`store-status store-status-${product.status === "published" ? "active" : product.status}`}>
                            {statusLabel(product.status, t)}
                          </span>
                        </div>
                        <h3>{product.name}</h3>
                        <strong className="product-price">{formatPrice(product.price_iqd, locale)}</strong>
                        <p className="store-meta">{product.unit_label}{product.stock_quantity !== null ? ` · ${t.productStock}: ${product.stock_quantity}` : ""}</p>
                        {product.description && <p className="product-description">{product.description}</p>}

                        <details className="product-edit-details">
                          <summary>{t.productEdit}</summary>
                          <form action={updateStoreProduct} className="product-form product-edit-form">
                            <input type="hidden" name="productId" value={product.id} />
                            <div className="product-form-grid">
                              <label>
                                {t.productCategory}
                                <select name="category" defaultValue={product.category}>
                                  {categories.map((category) => <option value={category} key={category}>{categoryLabel(category, t)}</option>)}
                                </select>
                              </label>
                              <label>
                                {t.productName}
                                <input name="name" required minLength={2} maxLength={120} defaultValue={product.name} />
                              </label>
                              <label>
                                {t.productSlug}
                                <input name="slug" dir="ltr" required minLength={3} maxLength={100} pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={product.slug} />
                              </label>
                              <label>
                                {t.productPrice}
                                <input name="priceIqd" type="number" min="1" max="100000000000" step="1" required defaultValue={product.price_iqd} />
                              </label>
                              <label>
                                {t.productUnit}
                                <input name="unitLabel" required maxLength={32} defaultValue={product.unit_label} />
                              </label>
                              <label>
                                {t.productStock}
                                <input name="stockQuantity" type="number" min="0" step="0.001" defaultValue={product.stock_quantity ?? ""} />
                              </label>
                              <label className="product-form-full">
                                {t.productDescriptionField}
                                <textarea name="description" rows={3} maxLength={2000} defaultValue={product.description ?? ""} />
                              </label>
                            </div>
                            <button className="secondary-action" type="submit">{t.productSave}</button>
                          </form>
                          {product.status !== "archived" && (
                            <form action={archiveStoreProduct} className="product-archive-form">
                              <input type="hidden" name="productId" value={product.id} />
                              <button type="submit" className="review-reject">{t.productArchive}</button>
                            </form>
                          )}
                        </details>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </section>
    </main>
  );
}
