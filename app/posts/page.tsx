import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMessages } from "@/lib/i18n/locale";

export const dynamic = "force-dynamic";

type PublicPost = {
  id: string;
  post_type: "announcement" | "promotion";
  title: string;
  body: string | null;
  image_path: string | null;
  reward_per_unit_iqd: number | string;
  max_reward_units: number | string;
  valid_until: string | null;
  published_at: string | null;
  stores: { name: string; slug: string } | null;
  products: { name: string; price_iqd: number | string; unit_label: string } | null;
};

function formatIqd(value: number | string, locale: string) {
  const number = Number(value);
  return `${number.toLocaleString(locale === "ku" ? "ku-IQ" : locale === "ar" ? "ar-IQ" : "en-IQ")} IQD`;
}

function formatDate(value: string | null, locale: string) {
  if (!value) return "—";
  const date = new Date(value);
  return new Intl.DateTimeFormat(
    locale === "ku" ? "ku-IQ" : locale === "ar" ? "ar-IQ" : "en-IQ",
    { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Baghdad" },
  ).format(date);
}

export default async function PublicPostsPage() {
  const [{ messages: t, locale }, supabase] = await Promise.all([
    getMessages(),
    createClient(),
  ]);

  const { data, error } = await supabase
    .from("posts")
    .select("id, post_type, title, body, image_path, reward_per_unit_iqd, max_reward_units, valid_until, published_at, stores!inner(name, slug), products(name, price_iqd, unit_label)")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(60);

  const missingSchema = Boolean(error && (
    error.code === "PGRST205"
    || error.code === "42P01"
    || /public\.posts|schema cache|does not exist/i.test(error.message)
  ));
  const posts = (data ?? []) as unknown as PublicPost[];

  return (
    <main className="catalog-page public-posts-page">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="SHAKH STORE">
          <span className="brand-mark">ش</span>
          <span><strong>SHAKH</strong><small>STORE</small></span>
        </Link>
        <nav className="catalog-header-actions">
          <Link href="/catalog">{t.productPublicCatalog}</Link>
          <Link href="/login">{t.login}</Link>
          <Link className="primary-action" href="/signup">{t.signup}</Link>
        </nav>
      </header>

      <section className="catalog-intro">
        <span className="eyebrow"><i /> {t.marketLabel}</span>
        <h1>{t.publicPostsTitle}</h1>
        <p>{t.publicPostsDescription}</p>
      </section>

      {missingSchema ? (
        <p className="empty-state">{t.postModuleUnavailable}</p>
      ) : error ? (
        <p className="empty-state" role="alert">{t.postActionFailed}</p>
      ) : posts.length === 0 ? (
        <p className="empty-state">{t.publicPostsEmpty}</p>
      ) : (
        <section className="public-post-grid" aria-label={t.publicPostsTitle}>
          {posts.map((post) => {
            const imageUrl = post.image_path
              ? supabase.storage.from("post-images").getPublicUrl(post.image_path).data.publicUrl
              : null;

            return (
              <article className="public-post-card" key={post.id}>
                {imageUrl && (
                  <Image
                    src={imageUrl}
                    alt={post.title}
                    width={960}
                    height={480}
                    unoptimized
                  />
                )}
                <div className="public-post-card-body">
                  <div className="public-post-meta">
                    <span className="store-type-label">
                      {post.post_type === "promotion" ? t.postTypePromotion : t.postTypeAnnouncement}
                    </span>
                    {post.stores && <span>{post.stores.name}</span>}
                  </div>
                  <h2>{post.title}</h2>
                  {post.body && <p>{post.body}</p>}
                  {post.post_type === "promotion" && (
                    <div className="public-post-reward">
                      {post.products && (
                        <div>
                          <span>{t.postProduct}</span>
                          <strong>{post.products.name}</strong>
                          <small>{formatIqd(post.products.price_iqd, locale)} · {post.products.unit_label}</small>
                        </div>
                      )}
                      <div>
                        <span>{t.postRewardPerUnit}</span>
                        <strong>{formatIqd(post.reward_per_unit_iqd, locale)}</strong>
                      </div>
                      <div>
                        <span>{t.postMaxUnits}</span>
                        <strong>{Number(post.max_reward_units).toLocaleString(locale === "ku" ? "ku-IQ" : locale === "ar" ? "ar-IQ" : "en-IQ")}</strong>
                      </div>
                      <div>
                        <span>{t.postValidUntil}</span>
                        <strong>{formatDate(post.valid_until, locale)}</strong>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
