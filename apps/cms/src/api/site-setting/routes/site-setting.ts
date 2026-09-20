import { factories } from "@strapi/strapi";

export default factories.createCoreRouter("api::site-setting.site-setting", {
  config: {
    find: { auth: false },
    findOne: { auth: false },
  },
});
