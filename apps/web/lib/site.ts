// Single source of truth for site identity. Everything imports from here.
// Domain per the association's statute (Art. 2°, means item d); override via env.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://cogollosdeloeste.com.ar"
).replace(/\/$/, "");
export const SITE_NAME = "Cogollos del Oeste";
export const SITE_LOGO = `${SITE_URL}/icon.png`;
