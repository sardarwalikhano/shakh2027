"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const MIN_PASSWORD_LENGTH = 12;

export async function signUp(formData: FormData) {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("passwordConfirmation") ?? "");

  if (fullName.length < 2 || fullName.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    redirect("/signup?error=invalid");
  }
  if (password.length < MIN_PASSWORD_LENGTH || password.length > 128 || password !== confirmation) {
    redirect("/signup?error=password");
  }

  if (!isSupabaseConfigured()) redirect("/signup?error=config");

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const emailRedirectTo = new URL("/auth/confirm", siteUrl);
  emailRedirectTo.searchParams.set("next", "/dashboard");

  let signupFailed = false;
  try {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: emailRedirectTo.toString(),
        data: { full_name: fullName },
      },
    });

    if (error) {
      signupFailed = true;
      // Log only provider error metadata; never log credentials or the submitted email.
      console.error("Signup request failed.", {
        name: error.name,
        status: error.status,
      });
    }
  } catch {
    signupFailed = true;
    console.error("Signup request threw an unexpected error.");
  }

  if (signupFailed) {
    redirect("/signup?error=signup");
  }

  redirect("/signup?message=check-email");
}
