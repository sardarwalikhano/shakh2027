import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SHAKH STORE",
    short_name: "SHAKH",
    description: "بازاڕی دیجیتاڵی شاخ",
    start_url: "/",
    display: "standalone",
    background_color: "#fffaf5",
    theme_color: "#f3a36f",
    lang: "ku",
    dir: "rtl",
    icons: [],
  };
}
