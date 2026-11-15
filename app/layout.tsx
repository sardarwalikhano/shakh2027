import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "./PwaRegister";

export const metadata: Metadata = {
  title: { default: "SHAKH STORE", template: "%s | SHAKH STORE" },
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ku" dir="rtl">
      <body>{children}<PwaRegister /></body>
    </html>
  );
}
