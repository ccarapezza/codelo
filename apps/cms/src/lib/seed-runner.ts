// Carga por única vez la configuración editorial de un proyecto en la base.
//
// El texto editorial vive en la base y se edita desde el panel (ver
// lib/prompt-defaults.ts). Pero una instancia recién levantada tiene la base
// vacía, y un proyecto que ya venía funcionando con sus valores en código no
// puede perderlos: la semilla es el puente entre las dos cosas.
//
// ⚠️ Va en `bootstrap()` y NO en `database/migrations/`. Verificado en Strapi
// 5.31.2: `db.schema.sync()` corre `migrations.up()` ANTES de `syncSchema()`,
// que es lo que crea las columnas — así que una migración no ve las columnas
// que agrega su propia versión. En el único arranque que importa, o rompe el
// boot o se saltea en silencio y queda marcada como hecha para siempre.
//
// Rellena SÓLO lo que está vacío. Un proyecto puede tener campos ya editados
// desde el panel y esos siempre ganan: la semilla pone piso, no techo.

import type { Core } from "@strapi/strapi";
import * as project from "./project";

/**
 * Números incluidos: un campo numérico con default en el schema (la ventana de
 * ingesta) queda en NULL en una fila que ya existía —el default sólo se aplica
 * a filas nuevas—, así que la semilla sí puede cargarlo.
 */
export type SeedValue = string | boolean | number;

export interface ProjectSeed {
  /**
   * Identifica esta semilla en el core-store. Una vez aplicada no vuelve a
   * correr nunca. Para sembrar campos nuevos más adelante se agrega OTRA
   * semilla con otra clave, no se edita esta.
   */
  key: string;
  /** Campos de `prompt-setting` (la configuración editorial). */
  promptSettings?: Record<string, SeedValue>;
  /** Campos de `site-setting` (modelos, integraciones). */
  siteSettings?: Record<string, SeedValue>;
}

const UIDS = {
  promptSettings: "api::prompt-setting.prompt-setting",
  siteSettings: "api::site-setting.site-setting",
} as const;

/** Vacío = no hay nada guardado. Un `false` guardado a propósito NO es vacío. */
function estaVacio(valor: unknown): boolean {
  if (valor === null || valor === undefined) return true;
  return typeof valor === "string" && valor.trim() === "";
}

type Resultado = { sembrados: string[]; conservados: string[]; ignorados: string[] };

async function sembrarTipo(
  strapi: Core.Strapi,
  uid: string,
  valores: Record<string, SeedValue>,
): Promise<Resultado> {
  const res: Resultado = { sembrados: [], conservados: [], ignorados: [] };

  // Si el schema no declara una clave, Strapi la descarta sin decir nada. Mejor
  // avisar: casi siempre significa que al proyecto le falta su delta de schema.
  const atributos = (strapi.contentType(uid as never) as { attributes: Record<string, unknown> })
    .attributes;

  const fila = (await strapi.db.query(uid).findOne({})) as Record<string, unknown> | null;

  const data: Record<string, SeedValue> = {};
  for (const [clave, valor] of Object.entries(valores)) {
    if (!(clave in atributos)) {
      res.ignorados.push(clave);
      continue;
    }
    if (estaVacio(fila?.[clave])) {
      data[clave] = valor;
      res.sembrados.push(clave);
    } else {
      res.conservados.push(clave);
    }
  }

  if (Object.keys(data).length > 0) {
    if (fila) {
      await strapi.db.query(uid).update({ where: { id: (fila as { id: number }).id }, data });
    } else {
      await strapi.db.query(uid).create({ data });
    }
  }
  return res;
}

export async function applyProjectSeeds(
  strapi: Core.Strapi,
  seeds: readonly ProjectSeed[],
): Promise<void> {
  if (seeds.length === 0) return;

  // Mismo criterio que la migración de i18n: sin PROJECT_SLUG explícito en
  // producción, el prefijo de la clave es un default del código y puede no ser
  // el que usó esta base. La clave es justamente lo que marca "ya corrió", así
  // que ante la duda no se corre.
  if (process.env.NODE_ENV === "production" && !project.slugExplicito) {
    strapi.log.error(
      "[seed] PROJECT_SLUG no está configurada: no se puede saber si la semilla ya " +
        "corrió en esta base. Se saltea por seguridad.",
    );
    return;
  }

  const coreStore = strapi.store({ type: "core" });

  for (const seed of seeds) {
    const clave = project.coreStoreKey(`seed:${seed.key}`);
    try {
      if (await coreStore.get({ key: clave })) continue;

      const partes: string[] = [];
      for (const [nombre, uid] of Object.entries(UIDS)) {
        const valores = seed[nombre as keyof typeof UIDS];
        if (!valores) continue;
        const r = await sembrarTipo(strapi, uid, valores);
        partes.push(
          `${nombre}: sembrados=[${r.sembrados.join(", ")}] conservados=[${r.conservados.join(", ")}]` +
            (r.ignorados.length > 0 ? ` IGNORADOS(no están en el schema)=[${r.ignorados.join(", ")}]` : ""),
        );
      }

      // El flag se marca sólo si todo salió bien: si algo falló, la próxima
      // vuelta reintenta en vez de dejar la base a medio sembrar para siempre.
      await coreStore.set({ key: clave, value: true });
      strapi.log.info(`[seed] ${seed.key} aplicada. ${partes.join(" | ")}`);
    } catch (err) {
      // Nunca bloquear el arranque por la semilla: sin ella el panel muestra los
      // valores neutros y el checklist de la home lo va a decir.
      strapi.log.error(`[seed] ${seed.key} falló (se reintenta en el próximo arranque):`, err);
    }
  }
}
