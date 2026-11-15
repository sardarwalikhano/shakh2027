"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { requireAnyRole } from "@/lib/auth/context";
import { isMerchantStoreType, isStoreSlug } from "@/lib/domain/stores";

function value(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function submitMerchantStore(formData: FormData) {
  await requireAnyRole(["restaurant", "supermarket", "meat_seafood_vendor", "baqal"]);

  const storeType = value(formData, "storeType");
  const name = value(formData, "name");
  const slug = value(formData, "slug").toLowerCase();
  const description = value(formData, "description");
  const phone = value(formData, "phone");
  const contactEmail = value(formData, "contactEmail").toLowerCase();
  const governorate = value(formData, "governorate");
  const district = value(formData, "district");
  const addressLine = value(formData, "addressLine");

  if (!isMerchantStoreType(storeType)) redirect("/dashboard/merchant/store?error=role");
  if (name.length < 2 || name.length > 120 || governorate.length < 2 || governorate.length > 100) {
    redirect("/dashboard/merchant/store?error=invalid");
  }
  if (slug && !isStoreSlug(slug)) {
    redirect("/dashboard/merchant/store?error=slug");
  }
  if (description.length > 1500 || phone.length > 32 || district.length > 100 || addressLine.length > 300) {
    redirect("/dashboard/merchant/store?error=invalid");
  }
  if (contactEmail && (contactEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))) {
    redirect("/dashboard/merchant/store?error=invalid");
  }

  if (!isSupabaseConfigured()) redirect("/dashboard/merchant/store?error=config");

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_merchant_store", {
    p_store_type: storeType,
    p_name: name,
    p_slug: slug || null,
    p_description: description || null,
    p_phone: phone || null,
    p_contact_email: contactEmail || null,
    p_governorate: governorate,
    p_district: district || null,
    p_address_line: addressLine || null,
  });

  if (error) {
    console.error("Merchant store application failed.", {
      code: error.code,
    });
    if (error.code === "23505") redirect("/dashboard/merchant/store?error=duplicate");
    if (error.code === "42501") redirect("/dashboard/merchant/store?error=role");
    if (error.code === "PGRST202" || error.code === "PGRST205" || error.code === "42P01") {
      redirect("/dashboard/merchant/store?error=migration");
    }
    redirect("/dashboard/merchant/store?error=submit");
  }

  redirect("/dashboard/merchant/store?success=created");
}
