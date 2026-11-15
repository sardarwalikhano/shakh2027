"use client";

import { type ChangeEvent } from "react";
import type { Locale } from "@/lib/i18n/messages";

const options: { value: Locale; label: string }[] = [
  { value: "ku", label: "کوردی" },
  { value: "ar", label: "العربية" },
  { value: "en", label: "English" },
];

export function LanguageSwitcher({ locale }: { locale: Locale }) {
  function onChange(event: ChangeEvent<HTMLSelectElement>) {
    const selected = event.target.value as Locale;
    document.cookie = `shakh_locale=${selected}; Path=/; Max-Age=31536000; SameSite=Lax`;
    window.location.reload();
  }

  return (
    <label className="language-switcher">
      <span className="sr-only">Language</span>
      <select aria-label="Language" value={locale} onChange={onChange}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}
