import { cookies } from "next/headers";
import { isLocale, messages, type Locale } from "./messages";

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get("shakh_locale")?.value;
  return isLocale(value) ? value : "ku";
}

export async function getMessages() {
  const locale = await getLocale();
  return { locale, direction: locale === "en" ? "ltr" as const : "rtl" as const, messages: messages[locale] };
}
