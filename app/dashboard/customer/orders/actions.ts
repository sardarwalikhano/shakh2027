"use server";

import { redirect } from "next/navigation";
import { requireAnyRole } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function cancelCustomerOrder(formData: FormData) {
  await requireAnyRole(["customer"]);
  const orderId = String(formData.get("orderId") ?? "").trim();

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) {
    redirect("/dashboard/customer/orders?error=invalid");
  }
  if (!isSupabaseConfigured()) redirect("/dashboard/customer/orders?error=config");

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_cod_order", { p_order_id: orderId });
  if (error) {
    console.error("Customer order cancellation failed.", { code: error.code });
    if (error.code === "55000") redirect("/dashboard/customer/orders?error=unavailable");
    if (error.code === "PGRST202" || error.code === "PGRST205" || error.code === "42P01") {
      redirect("/dashboard/customer/orders?error=migration");
    }
    redirect("/dashboard/customer/orders?error=failed");
  }

  redirect("/dashboard/customer/orders?success=cancelled");
}
