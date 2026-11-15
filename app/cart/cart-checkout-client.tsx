"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { checkoutCodOrder } from "./actions";
import { CART_STORAGE_KEY, type CartProduct } from "@/components/cart/add-to-cart-button";

type CartLine = CartProduct & { quantity: number };

type Props = {
  isAuthenticated: boolean;
  success: boolean;
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

function formatIqd(value: number, locale: string) {
  return `${value.toLocaleString(locale)} IQD`;
}

export function CartCheckoutClient({ isAuthenticated, success, labels }: Props) {
  const [items, setItems] = useState<CartLine[]>([]);
  const itemsInput = useRef<HTMLInputElement>(null);
  const [locale, setLocale] = useState("en-IQ");

  useEffect(() => {
    setLocale(document.documentElement.lang === "ku" ? "ku-IQ" : document.documentElement.lang === "ar" ? "ar-IQ" : "en-IQ");
    if (success) {
      window.localStorage.removeItem(CART_STORAGE_KEY);
      setItems([]);
      window.dispatchEvent(new Event("shakh-cart-updated"));
      return;
    }
    try {
      const raw = window.localStorage.getItem(CART_STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) {
        setItems([]);
        return;
      }
      const safe = parsed.filter((item): item is CartLine =>
        item && typeof item === "object"
        && typeof item.productId === "string"
        && typeof item.storeId === "string"
        && typeof item.name === "string"
        && typeof item.priceIqd === "number"
        && typeof item.quantity === "number"
      );
      setItems(safe);
    } catch {
      setItems([]);
    }
  }, [success]);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + Math.round(item.priceIqd * item.quantity), 0),
    [items],
  );

  function persist(next: CartLine[]) {
    setItems(next);
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next));
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

  function prepareCheckout(event: React.FormEvent<HTMLFormElement>) {
    if (!itemsInput.current || items.length === 0) {
      event.preventDefault();
      return;
    }
    itemsInput.current.value = JSON.stringify(items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
    })));
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
