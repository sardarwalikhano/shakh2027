"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { requireAnyRole } from "@/lib/auth/context";

export async function reviewMerchantStore(formData: FormData) {
  await requireAnyRole(["super_admin"]);

  const storeId = String(formData.get("storeId") ?? "").trim();
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(storeId)) {
    redirect("/dashboard/admin/stores?error=invalid");
  }
  if (decision !== "approve" && decision !== "reject") {
    redirect("/dashboard/admin/stores?error=invalid");
  }
  if (note.length > 1000) redirect("/dashboard/admin/stores?error=invalid");
  if (!isSupabaseConfigured()) redirect("/dashboard/admin/stores?error=config");

  const supabase = await createClient();
  const { error } = await supabase.rpc("review_merchant_store", {
    p_store_id: storeId,
    p_decision: decision,
    p_note: note || null,
  });

  if (error) {
    console.error("Merchant store review failed.", {
      code: error.code,
      status: error.status,
    });
    if (error.code === "42501") redirect("/dashboard/admin/stores?error=forbidden");
    if (error.code === "PGRST202" || error.code === "PGRST205" || error.code === "42P01") {
      redirect("/dashboard/admin/stores?error=migration");
    }
    redirect("/dashboard/admin/stores?error=review");
  }

  redirect(decision === "approve"
    ? "/dashboard/admin/stores?success=approved"
    : "/dashboard/admin/stores?success=rejected");
}
