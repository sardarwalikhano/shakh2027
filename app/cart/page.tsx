import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMessages } from "@/lib/i18n/locale";
import { CartCheckoutClient } from "./cart-checkout-client";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

export default async function CartPage({ searchParams }: Props) {
  const [{ messages: t }, params, supabase] = await Promise.all([
    getMessages(),
    searchParams,
    createClient(),
  ]);
  const { data: { user } } = await supabase.auth.getUser();

  const errorMessage = params.error === "migration" ? t.checkoutSchemaMissing
    : params.error === "unavailable" ? t.checkoutProductUnavailable
    : params.error === "forbidden" ? t.checkoutForbidden
    : params.error === "config" ? t.checkoutConfigError
    : params.error ? t.checkoutFailed
    : null;

  return (
    <main className="catalog-page cart-page">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="SHAKH STORE">
          <span className="brand-mark">ش</span>
          <span><strong>SHAKH</strong><small>STORE</small></span>
        </Link>
        <nav className="catalog-header-actions">
          <Link href="/catalog">{t.productPublicCatalog}</Link>
          <Link href="/dashboard">{user ? t.dashboardEyebrow : t.login}</Link>
        </nav>
      </header>
      <section className="catalog-intro">
        <span className="eyebrow"><i /> {t.marketLabel}</span>
        <h1>{t.cartTitle}</h1>
        <p>{t.cartDescription}</p>
      </section>
      {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
      <CartCheckoutClient
        isAuthenticated={Boolean(user)}
        success={params.success === "created"}
        labels={{
          cartTitle: t.cartTitle,
          cartDescription: t.cartDescription,
          cartEmpty: t.cartEmpty,
          continueShopping: t.continueShopping,
          remove: t.cartRemove,
          quantity: t.cartQuantity,
          subtotal: t.cartSubtotal,
          deliveryNote: t.cartDeliveryNote,
          customerName: t.checkoutCustomerName,
          customerPhone: t.checkoutCustomerPhone,
          deliveryAddress: t.checkoutAddress,
          deliveryNoteLabel: t.checkoutNote,
          checkout: t.checkoutPlaceOrder,
          loginToCheckout: t.checkoutLoginRequired,
          codOnly: t.checkoutCodOnly,
          checkoutSuccess: t.checkoutSuccess,
          viewOrders: t.customerOrdersLink,
          addToCart: t.addToCart,
          invalidCart: t.checkoutInvalidCart,
        }}
      />
    </main>
  );
}
