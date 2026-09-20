// Piezas compartidas para leer el CMS por REST: las formas crudas que devuelve
// Strapi y los dos helpers de URL. Las usan tanto los lectores del motor
// (lib/pages.ts) como los del proyecto (lib/vertical/content.ts).

export type StrapiMedia = { url?: string | null } | null | undefined;

export type StrapiPage = {
  title: string;
  slug: string;
  content: string;
  seoDescription?: string | null;
  coverImage?: StrapiMedia;
  updatedAt?: string | null;
};

export type StrapiEvent = {
  title: string;
  slug: string;
  startsAt: string;
  endsAt?: string | null;
  place?: string | null;
  organizer?: string | null;
  sourceUrl?: string | null;
  description?: string | null;
  coverImage?: StrapiMedia;
};

export type StrapiCollection<T> = { data: T[] };

export const getCmsBaseUrl = () => (process.env.NEXT_PUBLIC_CMS_URL ?? "").replace(/\/$/, "");

export const proxiedUrl = (path: string | null | undefined): string | null => {
  if (!path) return null;
  return path.startsWith("http://") || path.startsWith("https://") ? path : `/cms${path}`;
};
