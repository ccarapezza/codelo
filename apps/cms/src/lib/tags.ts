// Etiquetas: buscarlas por slug y elegir la que le toca a una nota que nadie
// etiquetó.
//
// Las tags no tienen draft & publish, así que se buscan sin pensar en estados.

import type { Core } from "@strapi/strapi";

const UID = "api::tag.tag";

/**
 * Lo que hace falta para relacionar una tag, en las dos formas que se usan: el
 * editor de notas guarda las etiquetas por `id` numérico y la API de
 * documentos relaciona por `documentId`.
 */
export type TagRef = { id: number; documentId: string };

export async function findTagBySlug(strapi: Core.Strapi, slug: string): Promise<TagRef | null> {
  const s = slug.trim();
  if (!s) return null;
  const tag = (await strapi.documents(UID).findFirst({
    filters: { slug: { $eq: s } },
    fields: ["slug"],
  })) as unknown as TagRef | null;
  return tag ? { id: tag.id, documentId: tag.documentId } : null;
}

/**
 * La etiqueta de las notas creadas a mano cuando el editor no elige ninguna
 * (`defaultPostTagSlug` en Ajustes del sitio). null si no hay una configurada.
 *
 * Si el slug configurado no existe, avisa y devuelve null: el panel no inventa
 * etiquetas. Crear una con un nombre adivinado desde el slug dejaría en el
 * sitio una sección que nadie eligió.
 */
export async function getDefaultPostTag(strapi: Core.Strapi): Promise<TagRef | null> {
  let slug = "";
  try {
    const cfg = (await strapi
      .documents("api::site-setting.site-setting")
      .findFirst({ fields: ["defaultPostTagSlug"] })) as unknown as {
      defaultPostTagSlug?: string | null;
    } | null;
    slug = (cfg?.defaultPostTagSlug ?? "").trim();
  } catch {
    // Falla suave: sin ajustes legibles, la nota se guarda como la mandó el editor.
    return null;
  }
  if (!slug) return null;

  const tag = await findTagBySlug(strapi, slug);
  if (!tag) {
    strapi.log.warn(
      `[tags] La etiqueta por defecto "${slug}" no existe; la nota se guarda sin etiqueta. ` +
        "Creala o corregí el slug en Ajustes del sitio.",
    );
  }
  return tag;
}

// Una sola consulta por slug y por proceso: las etiquetas que se aseguran así
// son fijas (las secciones de un vertical), y un runner que publica en tanda
// las pediría una vez por nota.
const cache = new Map<string, TagRef>();

/**
 * La etiqueta con ese slug; si no existe, la crea.
 *
 * Para las etiquetas que un vertical necesita que existan —las secciones fijas
 * en las que clasifica lo que publica—, no para lo que elige un editor: eso
 * pasa por `findTagBySlug`, que no inventa nada. Las tags no tienen draft &
 * publish, así que la creada queda visible en el acto.
 */
export async function ensureTagBySlug(
  strapi: Core.Strapi,
  def: { slug: string; name: string; kind?: string },
): Promise<TagRef> {
  const enCache = cache.get(def.slug);
  if (enCache) return enCache;

  const existente = await findTagBySlug(strapi, def.slug);
  const ref =
    existente ??
    ((await strapi.documents(UID).create({
      data: { name: def.name, slug: def.slug, kind: def.kind ?? "topic" } as never,
    })) as unknown as TagRef);

  const limpio = { id: ref.id, documentId: ref.documentId };
  cache.set(def.slug, limpio);
  return limpio;
}
