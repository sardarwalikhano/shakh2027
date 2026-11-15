"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { requireAnyRole } from "@/lib/auth/context";
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

function value(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function isUuid(input: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input);
}

async function hasValidImageSignature(file: File): Promise<boolean> {
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());

  if (file.type === "image/jpeg") {
    return header.length >= 3
      && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  }

  if (file.type === "image/png") {
    return header.length >= 8
      && header[0] === 0x89 && header[1] === 0x50
      && header[2] === 0x4e && header[3] === 0x47
      && header[4] === 0x0d && header[5] === 0x0a
      && header[6] === 0x1a && header[7] === 0x0a;
  }

  if (file.type === "image/webp") {
    return header.length >= 12
      && String.fromCharCode(...header.slice(0, 4)) === "RIFF"
      && String.fromCharCode(...header.slice(8, 12)) === "WEBP";
  }

  return false;
}

function mapPostError(code: string | undefined): never {
  if (code === "42501") redirect("/dashboard/posts?error=forbidden");
  if (code === "23514") redirect("/dashboard/posts?error=balance");
  if (code === "PGRST202" || code === "PGRST205" || code === "42P01") {
    redirect("/dashboard/posts?error=migration");
  }
  if (code === "P0002") redirect("/dashboard/posts?error=wallet");
  redirect("/dashboard/posts?error=failed");
}

function parseIqd(input: string): number | null {
  if (!/^[0-9]+$/.test(input)) return null;
  const amount = Number(input);
  return Number.isSafeInteger(amount) && amount >= 1 && amount <= 100_000_000_000
    ? amount
    : null;
}

function parseUnits(input: string): number | null {
  if (!/^[0-9]+$/.test(input)) return null;
  const amount = Number(input);
  return Number.isSafeInteger(amount) && amount >= 1 && amount <= 10_000_000
    ? amount
    : null;
}

function endOfIraqDate(date: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T20:59:59.999Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return null;
  return parsed.toISOString();
}

export async function createStorePost(formData: FormData) {
  await requireAnyRole(MANAGER_ROLES);

  const storeId = value(formData, "storeId");
  const postType = value(formData, "postType");
  const title = value(formData, "title");
  const body = value(formData, "body");
  const productId = value(formData, "productId");
  const rewardPerUnit = value(formData, "rewardPerUnitIqd");
  const maxUnits = value(formData, "maxRewardUnits");
  const validUntil = value(formData, "validUntil");
  const image = formData.get("image");

  if (
    !isUuid(storeId)
    || !["announcement", "promotion"].includes(postType)
    || title.length < 2
    || title.length > 140
    || body.length > 5000
  ) {
    redirect("/dashboard/posts?error=invalid");
  }

  let productUuid: string | null = null;
  let reward: number | null = null;
  let units: number | null = null;
  let validFrom: string | null = null;
  let validTo: string | null = null;

  if (postType === "promotion") {
    productUuid = isUuid(productId) ? productId : null;
    reward = parseIqd(rewardPerUnit);
    units = parseUnits(maxUnits);
    validTo = endOfIraqDate(validUntil);
    validFrom = new Date().toISOString();

    if (!productUuid || !reward || !units || !validTo || new Date(validTo).getTime() <= Date.now()) {
      redirect("/dashboard/posts?error=invalid");
    }

    const budget = BigInt(reward) * BigInt(units);
    if (budget > 9_223_372_036_854_775_807n) {
      redirect("/dashboard/posts?error=invalid");
    }
  }

  let imageFile: File | null = null;
  if (image instanceof File && image.size > 0) {
    if (
      image.size > PRODUCT_IMAGE_MAX_BYTES
      || !isProductImageMimeType(image.type)
      || !(await hasValidImageSignature(image))
    ) {
      redirect("/dashboard/posts?error=image");
    }
    imageFile = image;
  }

  if (!isSupabaseConfigured()) redirect("/dashboard/posts?error=config");

  const supabase = await createClient();
  let imagePath: string | null = null;

  if (imageFile) {
    const extension = PRODUCT_IMAGE_TYPES[imageFile.type];
    imagePath = `${storeId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("post-images")
      .upload(imagePath, imageFile, {
        cacheControl: "3600",
        contentType: imageFile.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Post image upload failed.", { message: uploadError.message });
      redirect("/dashboard/posts?error=image");
    }
  }

  const { error } = await supabase.rpc("create_store_post", {
    p_store_id: storeId,
    p_post_type: postType,
    p_title: title,
    p_body: body || null,
    p_image_path: imagePath,
    p_product_id: productUuid,
    p_reward_per_unit_iqd: reward ?? 0,
    p_max_reward_units: units ?? 0,
    p_valid_from: validFrom,
    p_valid_until: validTo,
  });

  if (error) {
    if (imagePath) {
      await supabase.storage.from("post-images").remove([imagePath]);
    }
    console.error("Post creation failed.", { code: error.code });
    mapPostError(error.code);
  }

  redirect("/dashboard/posts?success=draft");
}

export async function publishStorePost(formData: FormData) {
  await requireAnyRole(MANAGER_ROLES);
  const postId = value(formData, "postId");
  if (!isUuid(postId)) redirect("/dashboard/posts?error=invalid");
  if (!isSupabaseConfigured()) redirect("/dashboard/posts?error=config");

  const supabase = await createClient();
  const { data: post, error: readError } = await supabase
    .from("posts")
    .select("id, post_type")
    .eq("id", postId)
    .maybeSingle();

  if (readError || !post) mapPostError(readError?.code);
  const rpcName = post.post_type === "promotion"
    ? "publish_store_promotion"
    : "publish_store_post";

  const { error } = await supabase.rpc(rpcName, { p_post_id: postId });
  if (error) {
    console.error("Post publication failed.", { code: error.code });
    mapPostError(error.code);
  }

  redirect("/dashboard/posts?success=published");
}

export async function archiveStorePost(formData: FormData) {
  await requireAnyRole(MANAGER_ROLES);
  const postId = value(formData, "postId");
  if (!isUuid(postId)) redirect("/dashboard/posts?error=invalid");
  if (!isSupabaseConfigured()) redirect("/dashboard/posts?error=config");

  const supabase = await createClient();
  const { error } = await supabase.rpc("archive_store_post", { p_post_id: postId });
  if (error) {
    console.error("Post archival failed.", { code: error.code });
    mapPostError(error.code);
  }

  redirect("/dashboard/posts?success=archived");
}
