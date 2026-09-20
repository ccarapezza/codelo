import { factories } from "@strapi/strapi";

export default factories.createCoreRouter("api::house-ad.house-ad", {
  config: {
    find: { auth: false },
    findOne: { auth: false },
  },
});
