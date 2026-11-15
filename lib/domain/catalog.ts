import type { ProductCategory, StoreType } from "./roles";
import { PRODUCT_CATEGORIES } from "./roles";

export type ProductStoreCategory = {
  storeType: StoreType;
  category: ProductCategory;
};

export function categoriesForStore(storeType: StoreType): ProductCategory[] {
  if (storeType === "shakh_store") return [...PRODUCT_CATEGORIES];

  // Merchant categories are fixed by their approved store type.
  return [storeType as ProductCategory];
}

export function isAllowedCategoryForStore(
  storeType: StoreType,
  category: ProductCategory,
): boolean {
  return categoriesForStore(storeType).includes(category);
}

export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export const PRODUCT_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type ProductImageMimeType = keyof typeof PRODUCT_IMAGE_TYPES;

export function isProductImageMimeType(value: string): value is ProductImageMimeType {
  return Object.prototype.hasOwnProperty.call(PRODUCT_IMAGE_TYPES, value);
}
