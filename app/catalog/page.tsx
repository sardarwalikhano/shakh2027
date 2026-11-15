import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMessages } from "@/lib/i18n/locale";
import type { ProductCategory } from "@/lib/domain/roles";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";

export const dynamic = "force-dynamic";

type ProductRecord = {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  category: ProductCategory;
  price_iqd: number | string;
  unit_label: string;
  image_path: string;
  stock_quantity: number | string | null;
  stores: { name: string; slug: string; store_type: string } | null;
};

function formatPrice(value: number | string, locale: string) {
  return `${Number(value).toLocaleString(locale === "ku" ? "ku-IQ" : locale === "ar" ? "ar-IQ" : "en-IQ")} IQD`;
}

export default async function CatalogPage() {
  const [{ messages: t, locale }, supabase] = await Promise.all([
    getMessages(),
    createClient(),
  ]);

  const { data, error } = await supabase
    .from("products")
    .select("id, store_id, name, description, category, price_iqd, unit_label, image_path, stock_quantity, stores!inner(name, slug, store_type)")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(60);

  const missingMigration = Boolean(error && (
    error.code === "PGRST205"
    || error.code === "42P01"
    || /public\.products|schema cache|does not exist/i.test(error.message)
  ));
  const products = (data ?? []) as unknown as ProductRecord[];

  const categoryLabels: Record<ProductCategory, string> = {
    restaurant: t.productCategoryRestaurant,
    supermarket: t.productCategorySupermarket,
    meat_seafood: t.productCategoryMeatSeafood,
    baqal: t.productCategoryBaqal,
    produce: t.productCategoryProduce,
    drinks: t.productCategoryDrinks,
    household: t.productCategoryHousehold,
    other: t.productCategoryOther,
  };

  return (
    <main className="catalog-page">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="SHAKH STORE">
          <span className="brand-mark">ش</span>
          <span><strong>SHAKH</strong><small>STORE</small></span>
        </Link>
        <nav className="catalog-header-actions">
          <Link href="/cart">{t.cartTitle}</Link>
          <Link href="/login">{t.login}</Link>
          <Link className="primary-action" href="/signup">{t.signup}</Link>
        </nav>
      </header>
      <section className="catalog-intro">
        <span className="eyebrow"><i /> {t.marketLabel}</span>
        <h1>{t.productPublicCatalog}</h1>
        <p>{t.productCatalogDescription}</p>
      </section>

      {missingMigration ? (
        <p className="empty-state">{t.productModuleUnavailable}</p>
      ) : products.length === 0 ? (
        <p className="empty-state">{t.productPublicEmpty}</p>
      ) : (
        <section className="catalog-grid" aria-label={t.productPublicCatalog}>
          {products.map((product) => {
            const imageUrl = supabase.storage.from("product-images").getPublicUrl(product.image_path).data.publicUrl;
            return (
              <article className="catalog-card" key={product.id}>
                <Image src={imageUrl} alt={product.name} width={640} height={480} unoptimized />
                <div className="catalog-card-body">
                  <span className="store-type-label">{categoryLabels[product.category]}</span>
                  <h2>{product.name}</h2>
                  <strong className="product-price">{formatPrice(product.price_iqd, locale)}</strong>
                  <span className="store-meta">{product.unit_label}</span>
                  {product.description && <p>{product.description}</p>}
                  {product.stores && <small>{product.stores.name}</small>}
                  <AddToCartButton
                    product={{
                      productId: product.id,
                      storeId: product.store_id,
                      storeName: product.stores?.name ?? "",
                      name: product.name,
                      priceIqd: Number(product.price_iqd),
                      unitLabel: product.unit_label,
                      imagePath: product.image_path,
                      stockQuantity: product.stock_quantity === null ? null : Number(product.stock_quantity),
                    }}
                    label={t.addToCart}
                    addedLabel={t.addedToCart}
                  />
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
