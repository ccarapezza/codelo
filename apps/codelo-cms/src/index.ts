import type { Core } from "@strapi/strapi";
import { ensurePostCover } from "./lib/social-studio/post-cover";
import { ensurePostTranslation } from "./lib/translate-post";

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register({ strapi }: { strapi: Core.Strapi }) {
    // Safety-net: whenever a post is published without a cover image (Director
    // generation skipped/failed, or a note pushed straight through the REST
    // API), generate one in the background and attach it. Fire-and-forget so the
    // publish response isn't blocked; ensurePostCover no-ops if a cover exists.
    const COVER_TRIGGERS = new Set(["publish", "create", "update"]);
    strapi.documents.use(async (context, next) => {
      const result = await next();
      // create/update cover the case of REST-created posts that come in already
      // published; publish covers the Director / content-manager path. The
      // documentId may be on params (publish/update) or only on the result
      // (create). ensurePostCover no-ops unless the post is published & coverless.
      if (context.uid === "api::post.post" && COVER_TRIGGERS.has(context.action)) {
        const documentId =
          (context.params as { documentId?: string } | undefined)?.documentId ??
          (result as { documentId?: string } | null)?.documentId;
        const locale = (context.params as { locale?: string } | undefined)?.locale;
        if (documentId) {
          void ensurePostCover(strapi, documentId).catch((err) =>
            strapi.log.warn(`[post-cover] ensure failed for ${documentId}:`, err),
          );
          // Safety-net translation: posts published outside the Director (manual
          // REST publishes) still get their English localization. Skip operations
          // that target the "en" locale themselves — those are the translation's
          // own update/publish re-entering the middleware.
          if (locale !== "en") {
            void ensurePostTranslation(strapi, documentId).catch((err) =>
              strapi.log.warn(`[translate-post] ensure failed for ${documentId}:`, err),
            );
          }
        }
      }
      return result;
    });
  },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi } /* : { strapi: Core.Strapi } */) {
    // One-off i18n migration for posts. The server first booted with Strapi's
    // default locale ("en"), so when i18n was enabled on the post content-type
    // every existing row was stamped locale="en" — but all of them are written
    // in Spanish. Fix the default locale to "es" and re-stamp the rows. Guarded
    // by a core-store flag so it never runs twice (real "en" translations exist
    // after the first run, and re-stamping those would corrupt them).
    try {
      const coreStore = strapi.store({ type: "core" });
      const migrated = await coreStore.get({ key: "codelo:i18n-posts-migrated" });
      if (!migrated) {
        const locales = strapi.plugin("i18n").service("locales");
        const existing = (await locales.find()) as Array<{ code: string }>;
        if (!existing.some((l) => l.code === "es")) {
          await locales.create({ code: "es", name: "Spanish (es)" });
        }
        if (!existing.some((l) => l.code === "en")) {
          await locales.create({ code: "en", name: "English (en)" });
        }
        await locales.setDefaultLocale({ code: "es" });
        const updated = await strapi.db.connection("posts").update({ locale: "es" });
        await coreStore.set({ key: "codelo:i18n-posts-migrated", value: true });
        strapi.log.info(
          `[i18n-migration] default locale set to "es"; ${updated} post row(s) re-stamped as es.`,
        );
      }
    } catch (err) {
      // Never block boot on the migration — but make the failure loud so it
      // isn't silently skipped (the flag is only set on success, so it retries
      // on next boot).
      strapi.log.error(`[i18n-migration] failed (will retry next boot):`, err);
    }

    const actionsToEnable = [
      "api::post.post.find",
      "api::post.post.findOne",
      "api::tag.tag.find",
      "api::tag.tag.findOne",
      "api::site-setting.site-setting.find",
      "api::site-setting.site-setting.findOne",
    ];

    const publicRole = await strapi.db
      .query("plugin::users-permissions.role")
      .findOne({ where: { type: "public" } });

    if (!publicRole) return;

    for (const action of actionsToEnable) {
      const existing = await strapi.db
        .query("plugin::users-permissions.permission")
        .findOne({ where: { action, role: publicRole.id } });

      if (existing) continue;

      await strapi.db
        .query("plugin::users-permissions.permission")
        .create({ data: { action, role: publicRole.id } });
    }
  },
};
