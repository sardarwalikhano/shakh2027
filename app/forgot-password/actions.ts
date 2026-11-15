"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect("/forgot-password?error=invalid");
  }

  if (!isSupabaseConfigured()) redirect("/forgot-password?error=config");

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const redirectTo = new URL("/auth/callback", siteUrl);
  redirectTo.searchParams.set("next", "/reset-password");

  let sendFailed = false;
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectTo.toString(),
    });

    if (error) {
      sendFailed = true;
      // Log only provider error metadata; never log the submitted email address.
      console.error("Password recovery email request failed.", {
        name: error.name,
        status: error.status,
      });
    }
  } catch {
    sendFailed = true;
    console.error("Password recovery email request threw an unexpected error.");
  }

  if (sendFailed) redirect("/forgot-password?error=send");

  // Do not reveal whether the account exists.
  redirect("/forgot-password?message=sent");
}
