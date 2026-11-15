import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "./PwaRegister";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { getMessages } from "@/lib/i18n/locale";

export const metadata: Metadata = {
  title: {
    default: "SHAKH STORE",
    template: "%s | SHAKH STORE",
  },
  description: "بازاڕی دیجیتاڵی شاخ — کڕین و فرۆشتن لە عێراق",
  applicationName: "SHAKH STORE",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#f3a36f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { locale, direction } = await getMessages();

  return (
    <html lang={locale} dir={direction}>
      <body>
        <LanguageSwitcher locale={locale} />
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
