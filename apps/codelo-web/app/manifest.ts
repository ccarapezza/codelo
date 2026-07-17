import type { MetadataRoute } from "next";
import { SITE_NAME } from "@/lib/site";

// Web App Manifest. Next serves this at /manifest.webmanifest and injects the
// <link rel="manifest"> automatically. Icons in /public/icons are placeholders
// until real branding exists.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: "Portal de Cogollos del Oeste: información de cultivo, REPROCANN y actividades.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
