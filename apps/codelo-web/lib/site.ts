// Single source of truth for site identity. Everything imports from here.
// The real domain is TBD; override via env.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://cogollosdeloeste.example"
).replace(/\/$/, "");
export const SITE_NAME = "Cogollos del Oeste";
export const SITE_LOGO = `${SITE_URL}/icon.png`;
