"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useSyncExternalStore, type FormEvent } from "react";
import { checkoutCodOrder } from "./actions";
import { CART_STORAGE_KEY, CART_REQUEST_KEY, type CartProduct } from "@/components/cart/add-to-cart-button";

type CartLine = CartProduct & { quantity: number };

type Props = {
  isAuthenticated: boolean;
  success: boolean;
  locale: string;
  labels: {
    cartTitle: string;
    cartDescription: string;
    cartEmpty: string;
    continueShopping: string;
    remove: string;
    quantity: string;
    subtotal: string;
    deliveryNote: string;
    customerName: string;
    customerPhone: string;
    deliveryAddress: string;
    deliveryNoteLabel: string;
    checkout: string;
    loginToCheckout: string;
    codOnly: string;
    checkoutSuccess: string;
    viewOrders: string;
    addToCart: string;
    invalidCart: string;
  };
};

function subscribeCart(callback: () => void) {
  window.addEventListener("shakh-cart-updated", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("shakh-cart-updated", callback);
    window.removeEventListener("storage", callback);
  };
}

function getCartSnapshot() {
  return window.localStorage.getItem(CART_STORAGE_KEY) ?? "[]";
}

function getRequestKeySnapshot() {
  return window.localStorage.getItem(CART_REQUEST_KEY) ?? "";
}

function parseCart(raw: string): CartLine[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is CartLine =>
      item && typeof item === "object"
      && typeof item.productId === "string"
      && typeof item.storeId === "string"
      && typeof item.storeName === "string"
      && typeof item.name === "string"
      && typeof item.priceIqd === "number"
      && Number.isFinite(item.priceIqd)
      && typeof item.unitLabel === "string"
      && typeof item.imagePath === "string"
      && (item.stockQuantity === null || typeof item.stockQuantity === "number")
      && typeof item.quantity === "number"
      && Number.isFinite(item.quantity)
      && item.quantity > 0
    );
  } catch {
    return [];
  }
}

function formatIqd(value: number, locale: string) {
  const intlLocale = locale === "ku" ? "ku-IQ" : locale === "ar" ? "ar-IQ" : "en-IQ";
  return `${value.toLocaleString(intlLocale)} IQD`;
}

export function CartCheckoutClient({ isAuthenticated, success, locale, labels }: Props) {
  const rawCart = useSyncExternalStore(subscribeCart, getCartSnapshot, () => "[]");
  const requestKey = useSyncExternalStore(subscribeCart, getRequestKeySnapshot, () => "");
  const itemsInput = useRef<HTMLInputElement>(null);
  const requestKeyInput = useRef<HTMLInputElement>(null);
  const items = useMemo(() => parseCart(rawCart), [rawCart]);

  useEffect(() => {
    if (!success) return;
    window.localStorage.removeItem(CART_STORAGE_KEY);
    window.localStorage.removeItem(CART_REQUEST_KEY);
    window.dispatchEvent(new Event("shakh-cart-updated"));
  }, [success]);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + Math.round(item.priceIqd * item.quantity), 0),
    [items],
  );

  function persist(next: CartLine[]) {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next));
    const nextRequestKey = window.crypto.randomUUID();
    window.localStorage.setItem(CART_REQUEST_KEY, nextRequestKey);
    window.dispatchEvent(new Event("shakh-cart-updated"));
  }

  function updateQuantity(productId: string, quantity: number) {
    if (!Number.isFinite(quantity) || quantity < 0) return;
    persist(items.map((item) => item.productId === productId ? {
      ...item,
      quantity: item.stockQuantity === null ? quantity : Math.min(quantity, item.stockQuantity),
    } : item).filter((item) => item.quantity > 0));
  }

  function remove(productId: string) {
    persist(items.filter((item) => item.productId !== productId));
  }

  function prepareCheckout(event: FormEvent<HTMLFormElement>) {
    if (!itemsInput.current || !requestKeyInput.current || items.length === 0) {
      event.preventDefault();
      return;
    }
    itemsInput.current.value = JSON.stringify(items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
    })));
    if (!requestKeyInput.current.value) {
      const nextRequestKey = window.crypto.randomUUID();
      requestKeyInput.current.value = nextRequestKey;
      window.localStorage.setItem(CART_REQUEST_KEY, nextRequestKey);
    }
  }

  if (success) {
    return (
      <section className="cart-panel">
        <p className="form-success" role="status">{labels.checkoutSuccess}</p>
        <Link className="primary-action" href="/dashboard/customer/orders">{labels.viewOrders}</Link>
        <Link className="secondary-action" href="/catalog">{labels.continueShopping}</Link>
      </section>
    );
  }

  return (
    <div className="cart-layout">
      <section className="cart-items-panel">
        {items.length === 0 ? (
          <div className="empty-state">
            <p>{labels.cartEmpty}</p>
            <Link className="secondary-action" href="/catalog">{labels.continueShopping}</Link>
          </div>
        ) : items.map((item) => (
          <article className="cart-line" key={item.productId}>
            <div className="cart-line-main">
              <div>
                <strong>{item.name}</strong>
                <small>{item.storeName} · {item.unitLabel}</small>
                <small>{formatIqd(item.priceIqd, locale)} / {item.unitLabel}</small>
              </div>
              <strong>{formatIqd(Math.round(item.priceIqd * item.quantity), locale)}</strong>
            </div>
            <div className="cart-line-controls">
              <label>
                {labels.quantity}
                <input
                  type="number"
                  min="0"
                  max={item.stockQuantity ?? 100000}
                  step="0.001"
                  value={item.quantity}
                  onChange={(event) => updateQuantity(item.productId, Number(event.target.value))}
                />
              </label>
              <button className="review-reject" type="button" onClick={() => remove(item.productId)}>
                {labels.remove}
              </button>
            </div>
          </article>
        ))}
      </section>

      {items.length > 0 && (
        <aside className="cart-checkout-panel">
          <h2>{labels.checkout}</h2>
          <div className="cart-total-row">
            <span>{labels.subtotal}</span>
            <strong>{formatIqd(subtotal, locale)}</strong>
          </div>
          <p className="cart-delivery-note">{labels.deliveryNote}</p>
          <p className="cart-cod-note">{labels.codOnly}</p>
          {isAuthenticated ? (
            <form action={checkoutCodOrder} className="cart-checkout-form" onSubmit={prepareCheckout}>
              <input ref={itemsInput} type="hidden" name="items" />
              <input ref={requestKeyInput} type="hidden" name="requestKey" defaultValue={requestKey} />
              <label>
                {labels.customerName}
                <input name="customerName" required minLength={2} maxLength={120} />
              </label>
              <label>
                {labels.customerPhone}
                <input name="customerPhone" required minLength={7} maxLength={32} inputMode="tel" dir="ltr" />
              </label>
              <label>
                {labels.deliveryAddress}
                <textarea name="deliveryAddress" required minLength={5} maxLength={500} rows={3} />
              </label>
              <label>
                {labels.deliveryNoteLabel}
                <textarea name="deliveryNote" maxLength={1000} rows={2} />
              </label>
              <button className="primary-action" type="submit">{labels.checkout}</button>
            </form>
          ) : (
            <Link className="primary-action" href="/login?next=%2Fcart">{labels.loginToCheckout}</Link>
          )}
        </aside>
      )}
    </div>
  );
}
