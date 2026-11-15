import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuthContext } from "@/lib/auth/context";
import { getMessages } from "@/lib/i18n/locale";
import { isStoreType, type StoreType, type ProductCategory } from "@/lib/domain/roles";
import { archiveStorePost, createStorePost, publishStorePost } from "./actions";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ error?: string; success?: string }> };

type StoreRow = {
  id: string;
  store_type: StoreType;
  name: string;
};

type ProductRow = {
  id: string;
  store_id: string;
  name: string;
  category: ProductCategory;
  price_iqd: number | string;
};

type WalletRow = {
  id: string;
  store_id: string;
  available_iqd: number | string;
  reserved_iqd: number | string;
  status: "active" | "frozen";
};

type PostRow = {
  id: string;
  store_id: string;
  post_type: "announcement" | "promotion";
  title: string;
  body: string | null;
  image_path: string | null;
  product_id: string | null;
  reward_per_unit_iqd: number | string;
  max_reward_units: number | string;
  valid_from: string | null;
  valid_until: string | null;
  status: "draft" | "published" | "paused" | "archived";
  created_at: string;
};

type ReservationRow = {
  post_id: string;
  remaining_reward_budget_iqd: number | string;
  remaining_reward_units: number | string;
  status: "reserved" | "released" | "exhausted";
};

const MANAGER_ROLES = [
  "super_admin",
  "restaurant",
  "supermarket",
  "meat_seafood_vendor",
  "baqal",
] as const;

function formatIqd(value: number | string, locale: string) {
  const amount = Number(value);
  return `${amount.toLocaleString(locale === "ku" ? "ku-IQ" : locale === "ar" ? "ar-IQ" : "en-IQ")} IQD`;
}

function typeLabel(type: PostRow["post_type"], t: Awaited<ReturnType<typeof getMessages>>["messages"]) {
  return type === "promotion" ? t.postTypePromotion : t.postTypeAnnouncement;
}

function statusLabel(status: PostRow["status"], t: Awaited<ReturnType<typeof getMessages>>["messages"]) {
  if (status === "published") return t.postStatusPublished;
  if (status === "paused") return t.postStatusPaused;
  if (status === "archived") return t.postStatusArchived;
  return t.postStatusDraft;
}

export default async function PostsManagementPage({ searchParams }: Props) {
  const context = await requireAuthContext();
  if (!context.roles.some((role) => MANAGER_ROLES.includes(role as (typeof MANAGER_ROLES)[number]))) {
    redirect("/dashboard");
  }

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
      .select("id, store_type, name")
      .eq("store_type", "shakh_store")
      .is("owner_id", null)
      .eq("status", "active")
      .maybeSingle();
    if (error) storeError = error;
    else if (data && isStoreType(data.store_type)) stores.push(data as StoreRow);
  } else {
    const { data, error } = await supabase
      .from("stores")
      .select("id, store_type, name")
      .eq("owner_id", context.userId)
      .eq("status", "active")
      .order("created_at", { ascending: true });
    if (error) storeError = error;
    else {
      for (const row of data ?? []) {
        if (isStoreType(row.store_type)) stores.push(row as StoreRow);
      }
    }
  }

  const schemaMissing = (error: { code?: string; message: string } | null) => Boolean(error && (
    error.code === "PGRST205"
    || error.code === "42P01"
    || /schema cache|does not exist/i.test(error.message)
  ));

  const setupMissing = schemaMissing(storeError);
  const storeIds = stores.map((store) => store.id);

  let wallets: WalletRow[] = [];
  let walletError: { code?: string; message: string } | null = null;
  let products: ProductRow[] = [];
  let productError: { code?: string; message: string } | null = null;
  let posts: PostRow[] = [];
  let postError: { code?: string; message: string } | null = null;
  let reservations: ReservationRow[] = [];

  if (!setupMissing && storeIds.length > 0) {
    const [walletResult, productResult, postResult] = await Promise.all([
      supabase.from("wallets")
        .select("id, store_id, available_iqd, reserved_iqd, status")
        .eq("wallet_type", "merchant")
        .in("store_id", storeIds),
      supabase.from("products")
        .select("id, store_id, name, category, price_iqd")
        .in("store_id", storeIds)
        .eq("status", "published")
        .order("name"),
      supabase.from("posts")
        .select("id, store_id, post_type, title, body, image_path, product_id, reward_per_unit_iqd, max_reward_units, valid_from, valid_until, status, created_at")
        .in("store_id", storeIds)
        .order("created_at", { ascending: false }),
    ]);

    walletError = walletResult.error;
    productError = productResult.error;
    postError = postResult.error;

    wallets = (walletResult.data ?? []) as WalletRow[];
    products = (productResult.data ?? []) as ProductRow[];
    posts = (postResult.data ?? []) as PostRow[];

    if (!schemaMissing(postError) && posts.length > 0) {
      const { data: reservationData, error: reservationError } = await supabase
        .from("promotion_budget_reservations")
        .select("post_id, remaining_reward_budget_iqd, remaining_reward_units, status")
        .in("post_id", posts.map((post) => post.id));
      if (!reservationError) reservations = (reservationData ?? []) as ReservationRow[];
      else if (schemaMissing(reservationError)) postError = reservationError;
    }
  }

  const m05Missing = schemaMissing(walletError) || schemaMissing(postError);
  const m03Missing = setupMissing;
  const m04Missing = schemaMissing(productError);

  const errorMessage = m03Missing
    ? t.postM03Missing
    : m04Missing || m05Missing || params.error === "migration"
      ? t.postModuleUnavailable
      : params.error === "forbidden" ? t.postForbidden
      : params.error === "balance" ? t.postInsufficientBalance
      : params.error === "wallet" ? t.postWalletUnavailable
      : params.error === "image" ? t.postImageError
      : params.error === "failed" ? t.postActionFailed
      : params.error ? t.postInvalid
      : null;

  const successMessage = params.success === "draft"
    ? t.postDraftCreated
    : params.success === "published" ? t.postPublished
    : params.success === "archived" ? t.postArchived
    : null;

  const reservationByPost = new Map(reservations.map((row) => [row.post_id, row]));

  return (
    <main className="dashboard-page post-management-page">
      <section className="dashboard-section">
        <span className="eyebrow"><i /> {t.postEyebrow}</span>
        <h1 className="section-title">{t.postManagementTitle}</h1>
        <p className="section-description">{t.postManagementDescription}</p>

        {successMessage && <p className="form-success" role="status">{successMessage}</p>}
        {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}

        {!m03Missing && !m04Missing && !m05Missing && stores.length === 0 && (
          <p className="empty-state">{t.postNoActiveStore}</p>
        )}

        {!m03Missing && !m04Missing && !m05Missing && stores.map((store) => {
          const wallet = wallets.find((row) => row.store_id === store.id);
          const storeProducts = products.filter((product) => product.store_id === store.id);
          const storePosts = posts.filter((post) => post.store_id === store.id);

          return (
            <section className="post-store-section" key={store.id}>
              <div className="store-section-heading">
                <div>
                  <span className="store-type-label">{context.roles.includes("super_admin") ? t.platformStore : t.merchantTitle}</span>
                  <h2>{store.name}</h2>
                </div>
                <span>{storePosts.length}</span>
              </div>

              <div className="post-wallet-summary">
                <div>
                  <span>{t.walletAvailable}</span>
                  <strong>{wallet ? formatIqd(wallet.available_iqd, locale) : "—"}</strong>
                </div>
                <div>
                  <span>{t.walletReserved}</span>
                  <strong>{wallet ? formatIqd(wallet.reserved_iqd, locale) : "—"}</strong>
                </div>
                <p>{t.postWalletNote}</p>
              </div>

              <div className="post-form-panel">
                <h3>{t.postCreateTitle}</h3>
                <form action={createStorePost} className="post-form">
                  <input type="hidden" name="storeId" value={store.id} />
                  <div className="post-form-grid">
                    <label>
                      {t.postType}
                      <select name="postType" defaultValue="announcement" required>
                        <option value="announcement">{t.postTypeAnnouncement}</option>
                        <option value="promotion">{t.postTypePromotion}</option>
                      </select>
                    </label>
                    <label>
                      {t.postTitle}
                      <input name="title" minLength={2} maxLength={140} required />
                    </label>
                    <label className="post-form-full">
                      {t.postBody}
                      <textarea name="body" rows={4} maxLength={5000} />
                    </label>
                    <label className="post-form-full">
                      {t.postImage}
                      <input name="image" type="file" accept="image/jpeg,image/png,image/webp" />
                      <small>{t.postImageHint}</small>
                    </label>
                    <label>
                      {t.postProduct}
                      <select name="productId" defaultValue="">
                        <option value="">{t.postProductChoose}</option>
                        {storeProducts.map((product) => (
                          <option value={product.id} key={product.id}>
                            {product.name} · {formatIqd(product.price_iqd, locale)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {t.postRewardPerUnit}
                      <input name="rewardPerUnitIqd" type="number" min="1" max="100000000000" step="1" inputMode="numeric" />
                      <small>{t.postRewardPerUnitHint}</small>
                    </label>
                    <label>
                      {t.postMaxUnits}
                      <input name="maxRewardUnits" type="number" min="1" max="10000000" step="1" inputMode="numeric" />
                    </label>
                    <label>
                      {t.postValidUntil}
                      <input name="validUntil" type="date" />
                      <small>{t.postValidUntilHint}</small>
                    </label>
                  </div>
                  <button className="primary-action" type="submit">{t.postSaveDraft}<span>←</span></button>
                </form>
              </div>

              <div className="post-list">
                {storePosts.length === 0 ? (
                  <p className="empty-state">{t.postNoItems}</p>
                ) : storePosts.map((post) => {
                  const imageUrl = post.image_path
                    ? supabase.storage.from("post-images").getPublicUrl(post.image_path).data.publicUrl
                    : null;
                  const reservation = reservationByPost.get(post.id);
                  return (
                    <article className="post-card" key={post.id}>
                      {imageUrl && <Image src={imageUrl} alt={post.title} width={960} height={480} unoptimized />}
                      <div className="post-card-body">
                        <div className="post-card-heading">
                          <span className="store-type-label">{typeLabel(post.post_type, t)}</span>
                          <span className={`store-status store-status-${post.status}`}>{statusLabel(post.status, t)}</span>
                        </div>
                        <h3>{post.title}</h3>
                        {post.body && <p>{post.body}</p>}
                        {post.post_type === "promotion" && (
                          <div className="post-reward-summary">
                            <span>{t.postRewardPerUnit}: <strong>{formatIqd(post.reward_per_unit_iqd, locale)}</strong></span>
                            <span>{t.postMaxUnits}: <strong>{Number(post.max_reward_units).toLocaleString(locale === "ku" ? "ku-IQ" : locale === "ar" ? "ar-IQ" : "en-IQ")}</strong></span>
                            {reservation && reservation.status === "reserved" && (
                              <span>{t.postBudgetStillReserved}: <strong>{formatIqd(reservation.remaining_reward_budget_iqd, locale)}</strong></span>
                            )}
                          </div>
                        )}
                        <div className="post-card-actions">
                          {post.status === "draft" && (
                            <form action={publishStorePost}>
                              <input type="hidden" name="postId" value={post.id} />
                              <button className="secondary-action" type="submit">{t.postPublish}</button>
                            </form>
                          )}
                          {post.status !== "archived" && (
                            <form action={archiveStorePost}>
                              <input type="hidden" name="postId" value={post.id} />
                              <button className="review-reject" type="submit">{t.postArchive}</button>
                            </form>
                          )}
                        </div>
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
