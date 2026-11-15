import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAppRole, type AppRole } from "@/lib/domain/roles";

export type AuthContext = {
  userId: string;
  email: string | null;
  fullName: string | null;
  roles: AppRole[];
};

export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims || typeof claimsData.claims.sub !== "string") {
    return null;
  }

  const userId = claimsData.claims.sub;
  const email = typeof claimsData.claims.email === "string" ? claimsData.claims.email : null;

  const [{ data: profile, error: profileError }, { data: assignments, error: rolesError }] =
    await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

  if (profileError || rolesError) {
    throw new Error("SHAKH STORE database schema is not ready or the account profile could not be loaded.");
  }

  const roles = (assignments ?? [])
    .map((item) => item.role)
    .filter(isAppRole);

  return {
    userId,
    email,
    fullName: typeof profile?.full_name === "string" ? profile.full_name : null,
    roles,
  };
}

export async function requireAuthContext(): Promise<AuthContext> {
  const context = await getAuthContext();
  if (!context) redirect("/login");
  return context;
}

export async function requireAnyRole(allowed: readonly AppRole[]): Promise<AuthContext> {
  const context = await requireAuthContext();
  if (!context.roles.some((role) => allowed.includes(role))) {
    redirect("/dashboard");
  }
  return context;
}
