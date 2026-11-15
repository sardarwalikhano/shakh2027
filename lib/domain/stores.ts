import type { AppRole } from "./roles";

export const MERCHANT_STORE_TYPES = [
  "restaurant",
  "supermarket",
  "meat_seafood",
  "baqal",
] as const;

export type MerchantStoreType = (typeof MERCHANT_STORE_TYPES)[number];

export const MERCHANT_STORE_TYPE_BY_ROLE: Partial<Record<AppRole, MerchantStoreType>> = {
  restaurant: "restaurant",
  supermarket: "supermarket",
  meat_seafood_vendor: "meat_seafood",
  baqal: "baqal",
};

export const STORE_TYPE_LABEL_KEYS: Record<MerchantStoreType, string> = {
  restaurant: "storeTypeRestaurant",
  supermarket: "storeTypeSupermarket",
  meat_seafood: "storeTypeMeatSeafood",
  baqal: "storeTypeBaqal",
};

export function merchantStoreTypesForRoles(roles: readonly AppRole[]): MerchantStoreType[] {
  return [...new Set(
    roles
      .map((role) => MERCHANT_STORE_TYPE_BY_ROLE[role])
      .filter((value): value is MerchantStoreType => value !== undefined),
  )];
}

export function isMerchantStoreType(value: string): value is MerchantStoreType {
  return (MERCHANT_STORE_TYPES as readonly string[]).includes(value);
}

export function isStoreSlug(value: string): boolean {
  return value.length >= 3
    && value.length <= 80
    && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}
