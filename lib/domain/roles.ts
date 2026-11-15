export const APP_ROLES = [
  "super_admin",
  "restaurant",
  "supermarket",
  "meat_seafood_vendor",
  "baqal",
  "captain",
  "customer",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const STORE_TYPES = [
  "shakh_store",
  "restaurant",
  "supermarket",
  "meat_seafood",
  "baqal",
] as const;

export type StoreType = (typeof STORE_TYPES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "بەڕێوەبەری گشتی",
  restaurant: "چێشتخانە",
  supermarket: "سوپەرمارکێت",
  meat_seafood_vendor: "گۆشت و سپیاتی",
  baqal: "بەقالی",
  captain: "کاپتن",
  customer: "کڕیار",
};

export const ROLE_DEFAULT_PATH: Record<AppRole, string> = {
  super_admin: "/dashboard/admin",
  restaurant: "/dashboard/merchant",
  supermarket: "/dashboard/merchant",
  meat_seafood_vendor: "/dashboard/merchant",
  baqal: "/dashboard/merchant",
  captain: "/dashboard/captain",
  customer: "/dashboard/customer",
};

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && (APP_ROLES as readonly string[]).includes(value);
}

export function isStoreType(value: unknown): value is StoreType {
  return typeof value === "string" && (STORE_TYPES as readonly string[]).includes(value);
}

// Presentation helpers only. Database RLS and server actions remain the
// authoritative enforcement boundary for every protected operation.
export function canPublishCategory(role: AppRole, category: StoreType): boolean {
  if (role === "super_admin") return category !== "shakh_store";
  if (role === "restaurant") return category === "restaurant";
  if (role === "supermarket") return category === "supermarket";
  if (role === "meat_seafood_vendor") return category === "meat_seafood";
  if (role === "baqal") return category === "baqal";
  return false;
}
