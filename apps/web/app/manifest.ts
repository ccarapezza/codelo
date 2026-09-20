import type { MetadataRoute } from "next";
import { SITE_NAME, SITE_DESCRIPTION, MANIFEST_COLORS } from "@/lib/site";

// Web App Manifest. Next serves this at /manifest.webmanifest and injects the
// <link rel="manifest"> automatically. Icons in /public/brand derive from the
// real logo (public/brand/logo.png) — same source as app/icon.png y afines.
// Nombre, descripción y colores vienen de lib/site.ts.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    lang: "es",
    background_color: MANIFEST_COLORS.background,
    theme_color: MANIFEST_COLORS.theme,
    icons: [
      {
        src: "/brand/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
