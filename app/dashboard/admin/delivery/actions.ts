"use server";

import { redirect } from "next/navigation";
import { requireAnyRole } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

function field(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function saveStoreDeliveryFee(formData: FormData) {
  await requireAnyRole(["super_admin"]);

  const storeId = field(formData, "storeId");
  const rawFee = field(formData, "deliveryFeeIqd");
  const enabled = formData.get("isEnabled") === "on";

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(storeId)
    || !/^[0-9]+$/.test(rawFee)
  ) {
    redirect("/dashboard/admin/delivery?error=invalid");
  }

  const fee = Number(rawFee);
  if (!Number.isSafeInteger(fee) || fee < 0 || fee > 5_000_000) {
    redirect("/dashboard/admin/delivery?error=invalid");
  }
  if (!isSupabaseConfigured()) redirect("/dashboard/admin/delivery?error=config");

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_store_delivery_fee", {
    p_store_id: storeId,
    p_delivery_fee_iqd: fee,
    p_is_enabled: enabled,
  });

  if (error) {
    console.error("Delivery fee update failed.", { code: error.code });
    if (error.code === "42501") redirect("/dashboard/admin/delivery?error=forbidden");
    if (error.code === "PGRST202" || error.code === "PGRST205" || error.code === "42P01") {
      redirect("/dashboard/admin/delivery?error=migration");
    }
    redirect("/dashboard/admin/delivery?error=failed");
  }

  redirect("/dashboard/admin/delivery?success=saved");
}
