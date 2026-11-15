"use client";

import { useState } from "react";

export type CartProduct = {
  productId: string;
  storeId: string;
  storeName: string;
  name: string;
  priceIqd: number;
  unitLabel: string;
  imagePath: string;
  stockQuantity: number | null;
};

export const CART_STORAGE_KEY = "shakh-store-cart-v1";

type Props = { product: CartProduct; label: string; addedLabel: string };

export function AddToCartButton({ product, label, addedLabel }: Props) {
  const [added, setAdded] = useState(false);

  function addToCart() {
    try {
      const raw = window.localStorage.getItem(CART_STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      const cart = Array.isArray(parsed) ? parsed as (CartProduct & { quantity: number })[] : [];
      const existing = cart.find((item) => item.productId === product.productId);

      if (existing) {
        const next = existing.quantity + 1;
        existing.quantity = product.stockQuantity === null
          ? next
          : Math.min(next, product.stockQuantity);
      } else {
        cart.push({ ...product, quantity: 1 });
      }

      window.localStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify(cart.filter((item) => item.quantity > 0)),
      );
      window.dispatchEvent(new Event("shakh-cart-updated"));
      setAdded(true);
      window.setTimeout(() => setAdded(false), 1400);
    } catch {
      setAdded(false);
    }
  }

  const outOfStock = product.stockQuantity !== null && product.stockQuantity <= 0;

  return (
    <button
      className="secondary-action add-to-cart-button"
      type="button"
      onClick={addToCart}
      disabled={outOfStock}
      aria-live="polite"
    >
      {outOfStock ? "—" : added ? addedLabel : label}
    </button>
  );
}
