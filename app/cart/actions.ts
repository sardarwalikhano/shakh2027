"use server";

import { redirect } from "next/navigation";
import { requireAnyRole } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

function field(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function checkoutCodOrder(formData: FormData) {
  await requireAnyRole(["customer"]);

  if (!isSupabaseConfigured()) redirect("/cart?error=config");

  const rawItems = field(formData, "items");
  const customerName = field(formData, "customerName");
  const customerPhone = field(formData, "customerPhone");
  const deliveryAddress = field(formData, "deliveryAddress");
  const deliveryNote = field(formData, "deliveryNote");

  let items: unknown;
  try {
    items = JSON.parse(rawItems);
  } catch {
    redirect("/cart?error=invalid");
  }

  if (
    !Array.isArray(items)
    || items.length < 1
    || items.length > 50
    || customerName.length < 2
    || customerName.length > 120
    || customerPhone.length < 7
    || customerPhone.length > 32
    || deliveryAddress.length < 5
    || deliveryAddress.length > 500
    || deliveryNote.length > 1000
  ) {
    redirect("/cart?error=invalid");
  }

  const parsedItems: { product_id: string; quantity: number }[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") redirect("/cart?error=invalid");
    const row = item as Record<string, unknown>;
    const productId = row.product_id;
    const quantity = row.quantity;

    if (
      typeof productId !== "string"
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(productId)
      || typeof quantity !== "number"
      || !Number.isFinite(quantity)
      || quantity <= 0
      || quantity > 100000
      || Math.abs(quantity * 1000 - Math.round(quantity * 1000)) > 1e-8
    ) {
      redirect("/cart?error=invalid");
    }
    parsedItems.push({ product_id: productId, quantity });
  }

  if (new Set(parsedItems.map((item) => item.product_id)).size !== parsedItems.length) {
    redirect("/cart?error=invalid");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_cod_checkout", {
    p_items: parsedItems,
    p_customer_name: customerName,
    p_customer_phone: customerPhone,
    p_delivery_address: deliveryAddress,
    p_delivery_note: deliveryNote || null,
  });

  if (error) {
    console.error("COD checkout failed.", { code: error.code });
    if (error.code === "42501") redirect("/cart?error=forbidden");
    if (error.code === "23514" || error.code === "P0002") redirect("/cart?error=unavailable");
    if (error.code === "PGRST202" || error.code === "PGRST205" || error.code === "42P01") {
      redirect("/cart?error=migration");
    }
    redirect("/cart?error=failed");
  }

  redirect("/cart?success=created");
}
