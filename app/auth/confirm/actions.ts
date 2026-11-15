"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type VerificationType = "email" | "recovery";

export async function confirmAuthEmail(formData: FormData) {
  const tokenHash = String(formData.get("token_hash") ?? "").trim();
  const rawType = String(formData.get("type") ?? "");
  const type: VerificationType | null =
    rawType === "email" || rawType === "recovery" ? rawType : null;

  // Token hashes are short-lived credentials. Validate them, but never log or
  // echo them into URLs, error messages, analytics, or application logs.
  if (
    !type ||
    tokenHash.length < 16 ||
    tokenHash.length > 512 ||
    !/^[A-Za-z0-9_-]+$/.test(tokenHash)
  ) {
    redirect("/auth/confirm?error=invalid");
  }

  if (!isSupabaseConfigured()) {
    redirect("/auth/confirm?error=config");
  }

  const supabase = await createClient();
  let verificationFailed = false;

  try {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (error) {
      verificationFailed = true;
      console.error("Auth email verification failed.", {
        name: error.name,
        status: error.status,
      });
    }
  } catch {
    verificationFailed = true;
    console.error("Auth email verification threw an unexpected error.");
  }

  if (verificationFailed) {
    redirect("/auth/confirm?error=invalid");
  }

  // Do not accept a caller-supplied redirect URL. The allowed destination is
  // selected only from the verified email's operation type.
  if (type === "recovery") {
    redirect("/reset-password");
  }

  redirect("/dashboard");
}
