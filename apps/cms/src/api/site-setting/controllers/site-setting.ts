import { factories } from "@strapi/strapi";
import { requireAdminPermission } from "../../../lib/admin-auth";
import { ADMIN_PERMISSIONS } from "../../../lib/admin-permissions";
import { verticalSettingKeys } from "../../../verticals/setting-fields";
import {
  BOOLEAN_SETTING_KEYS,
  ENGINE_SETTING_KEYS,
  MEDIA_SETTING_KEY,
  NUMBER_SETTING_KEYS,
} from "../../../lib/setting-keys";

const UID = "api::site-setting.site-setting";


export default factories.createCoreController(UID, ({ strapi }) => ({
  async adminFind(ctx) {
    if (!(await requireAdminPermission(ctx, strapi, ADMIN_PERMISSIONS.siteSettings))) return;
    // `populate` del logo: sin esto la relación vuelve como undefined y el
    // panel muestra "sin logo" aunque haya uno cargado.
    const setting = await strapi.db.query(UID).findOne({ populate: { [MEDIA_SETTING_KEY]: true } });
    ctx.body = setting ?? {};
  },

  async adminUpdate(ctx) {
    if (!(await requireAdminPermission(ctx, strapi, ADMIN_PERMISSIONS.siteSettings))) return;
    const body = ctx.request.body as Record<string, unknown>;

    const permitidas = new Set<string>([...ENGINE_SETTING_KEYS, ...verticalSettingKeys, MEDIA_SETTING_KEY]);
    const desconocidas = Object.keys(body).filter((k) => !permitidas.has(k));
    if (desconocidas.length > 0) {
      return ctx.badRequest(`Campos desconocidos: ${desconocidas.join(", ")}`);
    }

    const data: Record<string, unknown> = {};
    for (const key of permitidas) {
      if (!(key in body)) continue;
      const value = body[key];
      if (key === MEDIA_SETTING_KEY) {
        // El logo llega como id de archivo, o null para volver al bundleado.
        // `Number(value)` y no String: guardarlo como texto deja la relación
        // vacía sin dar ningún error.
        const id = Number(value);
        data[key] = Number.isFinite(id) && id > 0 ? id : null;
        continue;
      }
      if (NUMBER_SETTING_KEYS.has(key)) {
        // Fuera de rango o ilegible vuelve a null, que en la base cae al
        // default del schema en vez de guardar un absurdo.
        const n = Math.trunc(Number(value));
        data[key] = Number.isFinite(n) && n >= 1 && n <= 90 ? n : null;
        continue;
      }
      data[key] = BOOLEAN_SETTING_KEYS.has(key)
        ? Boolean(value)
        : typeof value === "string"
          ? value
          : value == null
            ? null
            : String(value);
    }

    const existing = (await strapi.db.query(UID).findOne({})) as { id: number } | null;
    const populate = { [MEDIA_SETTING_KEY]: true };
    ctx.body = existing
      ? await strapi.db.query(UID).update({ where: { id: existing.id }, data, populate })
      : await strapi.db.query(UID).create({ data, populate });
  },

  // POST /site-setting/admin-logo (multipart, campo "file") -> { mediaId, url }
  //
  // Sube el logo de las placas a la Media Library y devuelve su id, que el
  // panel guarda después con el resto de los ajustes. Se sube aparte y no junto
  // al PUT porque el formulario manda JSON: mezclarlo obligaría a que todos los
  // ajustes viajaran como multipart.
  async adminUploadLogo(ctx) {
    if (!(await requireAdminPermission(ctx, strapi, ADMIN_PERMISSIONS.siteSettings))) return;
    const files = (ctx.request as unknown as { files?: Record<string, unknown> }).files;
    const file = files?.file;
    if (!file) return ctx.badRequest("Falta el archivo (multipart, campo 'file').");

    try {
      const uploaded = (await strapi
        .plugin("upload")
        .service("upload")
        .upload({ data: {}, files: file })) as Array<{ id: number; url: string; mime?: string }>;
      const first = uploaded?.[0];
      if (!first) return ctx.internalServerError("La subida no devolvió ningún archivo.");
      if (first.mime && !first.mime.startsWith("image/")) {
        // Si subieron otra cosa la borramos, para no dejar basura suelta en la
        // Media Library por un click equivocado.
        await strapi.plugin("upload").service("upload").remove({ id: first.id }).catch(() => {});
        return ctx.badRequest("El logo tiene que ser una imagen.");
      }
      ctx.body = { mediaId: first.id, url: first.url };
    } catch (err) {
      strapi.log.error("[site-setting] adminUploadLogo falló:", err);
      return ctx.internalServerError("No se pudo subir el logo.");
    }
  },
}));
