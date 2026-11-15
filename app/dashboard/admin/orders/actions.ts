"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAnyRole } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function value(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function adminCancelOrder(formData: FormData) {
  await requireAnyRole(["super_admin"]);

  const orderId = value(formData, "orderId");
  const reason = value(formData, "reason");
  const idempotencyKey = value(formData, "idempotencyKey");

  if (
    !UUID_PATTERN.test(orderId)
    || reason.length < 3
    || reason.length > 500
    || idempotencyKey.length < 12
    || idempotencyKey.length > 160
  ) {
    redirect("/dashboard/admin/orders?error=invalid");
  }

  if (!isSupabaseConfigured()) redirect("/dashboard/admin/orders?error=config");

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_cancel_order", {
    p_order_id: orderId,
    p_reason: reason,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    console.error("Super Admin order cancellation failed.", { code: error.code });
    if (error.code === "42501") redirect("/dashboard/admin/orders?error=forbidden");
    if (error.code === "55000") redirect("/dashboard/admin/orders?error=unavailable");
    if (error.code === "23505") redirect("/dashboard/admin/orders?error=conflict");
    if (error.code === "PGRST202" || error.code === "PGRST205" || error.code === "42P01") {
      redirect("/dashboard/admin/orders?error=migration");
    }
    redirect("/dashboard/admin/orders?error=failed");
  }

  revalidatePath("/dashboard/admin/orders");
  revalidatePath("/dashboard/merchant/orders");
  revalidatePath("/dashboard/customer/orders");
  redirect("/dashboard/admin/orders?success=cancelled");
}
