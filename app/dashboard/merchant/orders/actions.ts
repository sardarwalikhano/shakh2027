"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAnyRole } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const MERCHANT_ROLES = [
  "restaurant",
  "supermarket",
  "meat_seafood_vendor",
  "baqal",
] as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function value(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function fail(code: string | undefined): never {
  if (code === "42501") redirect("/dashboard/merchant/orders?error=forbidden");
  if (code === "55000") redirect("/dashboard/merchant/orders?error=unavailable");
  if (code === "23505") redirect("/dashboard/merchant/orders?error=conflict");
  if (code === "PGRST202" || code === "PGRST205" || code === "42P01") {
    redirect("/dashboard/merchant/orders?error=migration");
  }
  redirect("/dashboard/merchant/orders?error=failed");
}

export async function transitionMerchantOrder(formData: FormData) {
  await requireAnyRole(MERCHANT_ROLES);

  const orderId = value(formData, "orderId");
  const nextStatus = value(formData, "nextStatus");
  const reason = value(formData, "reason");
  const idempotencyKey = value(formData, "idempotencyKey");

  if (
    !UUID_PATTERN.test(orderId)
    || !["accepted", "preparing", "ready_for_pickup", "cancelled"].includes(nextStatus)
    || idempotencyKey.length < 12
    || idempotencyKey.length > 160
    || reason.length > 500
    || (nextStatus === "cancelled" && reason.length < 3)
  ) {
    redirect("/dashboard/merchant/orders?error=invalid");
  }

  if (!isSupabaseConfigured()) redirect("/dashboard/merchant/orders?error=config");

  const supabase = await createClient();
  const { error } = await supabase.rpc("merchant_transition_order", {
    p_order_id: orderId,
    p_next_status: nextStatus,
    p_reason: reason || null,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    console.error("Merchant order transition failed.", { code: error.code });
    fail(error.code);
  }

  revalidatePath("/dashboard/merchant/orders");
  revalidatePath("/dashboard/customer/orders");
  revalidatePath("/dashboard/admin/orders");
  redirect(nextStatus === "cancelled"
    ? "/dashboard/merchant/orders?success=cancelled"
    : "/dashboard/merchant/orders?success=status");
}
