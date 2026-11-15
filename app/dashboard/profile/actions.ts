"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { requireAuthContext } from "@/lib/auth/context";

export async function updateOwnProfile(formData: FormData) {
  const context = await requireAuthContext();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const rawPhone = String(formData.get("phone") ?? "").trim();
  const phone = rawPhone || null;

  if (
    fullName.length < 2
    || fullName.length > 120
    || (phone !== null && (
      phone.length < 7
      || phone.length > 32
      || !/^[0-9+().\s-]+$/.test(phone)
    ))
  ) {
    redirect("/dashboard/profile?error=invalid");
  }

  if (!isSupabaseConfigured()) {
    redirect("/dashboard/profile?error=config");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      phone,
    })
    .eq("id", context.userId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Profile update failed.", {
      code: error.code,
    });
    redirect("/dashboard/profile?error=update");
  }

  if (!data) {
    redirect("/dashboard/profile?error=forbidden");
  }

  redirect("/dashboard/profile?success=updated");
}
