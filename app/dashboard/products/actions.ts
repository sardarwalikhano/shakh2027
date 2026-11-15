"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { requireAnyRole } from "@/lib/auth/context";
import { isProductCategory } from "@/lib/domain/roles";
import {
  isProductImageMimeType,
  PRODUCT_IMAGE_MAX_BYTES,
  PRODUCT_IMAGE_TYPES,
} from "@/lib/domain/catalog";

const MANAGER_ROLES = [
  "super_admin",
  "restaurant",
  "supermarket",
  "meat_seafood_vendor",
  "baqal",
] as const;

function field(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function parseProductValues(formData: FormData) {
  const category = field(formData, "category");
  const name = field(formData, "name");
  const slug = field(formData, "slug").toLowerCase();
  const description = field(formData, "description");
  const price = Number(field(formData, "priceIqd"));
  const unit = field(formData, "unitLabel");
  const rawStock = field(formData, "stockQuantity");
  const stock = rawStock === "" ? null : Number(rawStock);

  if (
    !isProductCategory(category)
    || name.length < 2
    || name.length > 120
    || description.length > 2000
    || (slug !== "" && (
      slug.length < 3
      || slug.length > 100
      || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
    ))
    || !Number.isSafeInteger(price)
    || price < 1
    || price > 100_000_000_000
    || unit.length < 1
    || unit.length > 32
    || (stock !== null && (
      !Number.isFinite(stock)
      || stock < 0
      || stock > 99_999_999_999.999
      || Math.abs(stock * 1000 - Math.round(stock * 1000)) > 1e-8
    ))
  ) {
    return null;
  }

  return {
    category,
    name,
    slug: slug || null,
    description: description || null,
    price,
    unit,
    stock,
  };
}

function redirectForProductError(code: string | undefined, fallback: string): never {
  if (code === "42501") redirect("/dashboard/products?error=forbidden");
  if (code === "23505") redirect("/dashboard/products?error=duplicate");
  if (code === "PGRST202" || code === "PGRST205" || code === "42P01") {
    redirect("/dashboard/products?error=migration");
  }
  redirect(fallback);
}

async function hasValidImageSignature(file: File): Promise<boolean> {
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());

  if (file.type === "image/jpeg") {
    return header.length >= 3
      && header[0] === 0xff
      && header[1] === 0xd8
      && header[2] === 0xff;
  }

  if (file.type === "image/png") {
    return header.length >= 8
      && header[0] === 0x89
      && header[1] === 0x50
      && header[2] === 0x4e
      && header[3] === 0x47
      && header[4] === 0x0d
      && header[5] === 0x0a
      && header[6] === 0x1a
      && header[7] === 0x0a;
  }

  if (file.type === "image/webp") {
    return header.length >= 12
      && String.fromCharCode(...header.slice(0, 4)) === "RIFF"
      && String.fromCharCode(...header.slice(8, 12)) === "WEBP";
  }

  return false;
}

export async function createStoreProduct(formData: FormData) {
  await requireAnyRole(MANAGER_ROLES);

  const storeId = field(formData, "storeId");
  const values = parseProductValues(formData);
  const image = formData.get("image");

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(storeId)
    || !values
    || !(image instanceof File)
    || image.size < 1
    || image.size > PRODUCT_IMAGE_MAX_BYTES
    || !isProductImageMimeType(image.type)
    || !(await hasValidImageSignature(image))
  ) {
    redirect("/dashboard/products?error=invalid");
  }

  if (!isSupabaseConfigured()) redirect("/dashboard/products?error=config");

  const supabase = await createClient();
  const extension = PRODUCT_IMAGE_TYPES[image.type];
  const imagePath = `${storeId}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("product-images")
    .upload(imagePath, image, {
      cacheControl: "3600",
      contentType: image.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("Product image upload failed.", { message: uploadError.message });
    redirect("/dashboard/products?error=image");
  }

  const { error } = await supabase.rpc("create_store_product", {
    p_store_id: storeId,
    p_category: values.category,
    p_name: values.name,
    p_slug: values.slug,
    p_description: values.description,
    p_price_iqd: values.price,
    p_unit_label: values.unit,
    p_stock_quantity: values.stock,
    p_image_path: imagePath,
  });

  if (error) {
    await supabase.storage.from("product-images").remove([imagePath]);
    console.error("Product creation failed.", { code: error.code });
    redirectForProductError(error.code, "/dashboard/products?error=create");
  }

  redirect("/dashboard/products?success=created");
}

export async function updateStoreProduct(formData: FormData) {
  await requireAnyRole(MANAGER_ROLES);

  const productId = field(formData, "productId");
  const values = parseProductValues(formData);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(productId)
    || !values
    || !values.slug
  ) {
    redirect("/dashboard/products?error=invalid");
  }
  if (!isSupabaseConfigured()) redirect("/dashboard/products?error=config");

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_store_product", {
    p_product_id: productId,
    p_category: values.category,
    p_name: values.name,
    p_slug: values.slug ?? "",
    p_description: values.description,
    p_price_iqd: values.price,
    p_unit_label: values.unit,
    p_stock_quantity: values.stock,
  });

  if (error) {
    console.error("Product update failed.", { code: error.code });
    redirectForProductError(error.code, "/dashboard/products?error=update");
  }
  redirect("/dashboard/products?success=updated");
}

export async function archiveStoreProduct(formData: FormData) {
  await requireAnyRole(MANAGER_ROLES);

  const productId = field(formData, "productId");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(productId)) {
    redirect("/dashboard/products?error=invalid");
  }
  if (!isSupabaseConfigured()) redirect("/dashboard/products?error=config");

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_store_product_status", {
    p_product_id: productId,
    p_status: "archived",
  });

  if (error) {
    console.error("Product archive failed.", { code: error.code });
    redirectForProductError(error.code, "/dashboard/products?error=archive");
  }
  redirect("/dashboard/products?success=archived");
}
